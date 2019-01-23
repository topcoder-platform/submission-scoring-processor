/**
 * The test cases for Challenge Registration Processor.
 */
global.Promise = require('bluebird')
const _ = require('lodash')
const axios = require('axios')
const Kafka = require('no-kafka')
const config = require('config')
const should = require('should')
const logger = require('../../src/common/logger')
const { sleep } = require('../common/helper')

const {
  stringFields, testMethods, noSubChallengeId,
  reviewCreateMessage, reviewUpdateMessage,
  appealsResponseClosureMessage, noESReviewId, noValidReviewId
} = require('../common/testData')

const options = { connectionString: config.KAFKA_URL,
  handlerConcurrency: 1,
  groupId: config.KAFKA_GROUP_ID }

if (config.KAFKA_CLIENT_CERT && config.KAFKA_CLIENT_CERT_KEY) {
  options.ssl = { cert: config.KAFKA_CLIENT_CERT, key: config.KAFKA_CLIENT_CERT_KEY }
}

const WAIT_TIME = config.WAIT_TIME

describe('Submission Scoring Processor e2e Tests', () => {
  let appConsumer
  const infoLogs = []
  const errorLogs = []
  const debugLogs = []
  const debug = logger.debug
  const info = logger.info
  const error = logger.error

  /**
   * Assert error logs
   * @param message the error message to validate
   */
  const assertErrorLogs = (message) => {
    errorLogs.should.not.be.empty()
    errorLogs.some(x => String(x).includes(message)).should.be.true()
  }

  const producer = new Kafka.Producer(options)

  /**
   * Send message
   * @param testMessage the test message
   */
  const sendMessage = async (testMessage) => {
    await producer.send({
      topic: testMessage.topic,
      message: {
        value: JSON.stringify(testMessage)
      }
    })
  }

  /**
   * Set field in a payload
   * @param message the message
   * @param field Field to which value need to be set
   * @param value Value to be assigned
   */
  const setPayloadField = (message, field, value) => {
    message.payload[field] = value
  }

  /**
   * Consume not committed messages before e2e test
   */
  const consumeMessages = async () => {
    // remove all not processed messages
    const consumer = new Kafka.GroupConsumer(options)
    await consumer.init([{
      subscriptions: [config.CREATE_DATA_TOPIC, config.UPDATE_DATA_TOPIC,
        config.AUTOPILOT_EVENT_TOPIC],
      handler: (messageSet, topic, partition) => Promise.each(messageSet, (m) => consumer.commitOffset({ topic, partition, offset: m.offset }))
    }])
    // make sure process all not committed messages before test
    await sleep(2 * WAIT_TIME)
    await consumer.end()
  }

  /**
   * Wait until there is any error or the process is exit
   */
  const waitJob = async () => {
    while (true) {
      if (errorLogs.length > 0) {
        break
      }
      if (debugLogs.some(x => x.startsWith('EXIT process'))) {
        break
      }
      // use small time to wait job and there is a global timeout to prevent infinite waiting
      await sleep(WAIT_TIME)
    }
  }

  before(async () => {
    // inject logger with log collector
    logger.info = (message) => {
      infoLogs.push(message)
      info(message)
    }

    logger.debug = (message) => {
      debugLogs.push(message)
      debug(message)
    }

    logger.error = (message) => {
      errorLogs.push(message)
      error(message)
    }

    await consumeMessages()
    // start kafka producer
    await producer.init()
    // start the application (kafka listener)
    appConsumer = require('../../src/app').consumer
    // wait until consumer init successfully
    while (true) {
      if (debugLogs.includes('Consumer initialized successfully')) {
        break
      }
      await sleep(WAIT_TIME)
    }
  })

  beforeEach(async () => {
    // clear logs
    infoLogs.length = 0
    errorLogs.length = 0
    debugLogs.length = 0
  })

  after(async () => {
    // restore logger
    logger.error = error
    logger.info = info
    logger.debug = debug
    try {
      await producer.end()
    } catch (err) {
      // ignore
    }
    try {
      await appConsumer.end()
    } catch (err) {
      // ignore
    }
  })

  it('Should setup healthcheck with check on kafka connection', async () => {
    const healthcheckEndpoint = `http://localhost:${process.env.PORT || 3000}/health`
    let result = await axios.get(healthcheckEndpoint)
    should.equal(result.status, 200)
    should.deepEqual(result.data, { checksRun: 1 })
    debugLogs.should.match(/connected=true/)
  })

  it('Should handle invalid json message', async () => {
    const { testMessage } = testMethods['createReview']
    await producer.send({
      topic: testMessage.topic,
      message: {
        value: '[ { - a b c'
      }
    })
    await waitJob()
    should.equal(errorLogs[0], 'Invalid message JSON.')
  })

  it('Should handle wrong topic message', async () => {
    const { testMessage } = testMethods['updateReview']
    let message = _.cloneDeep(testMessage)
    message.topic = 'invalid'
    await producer.send({
      topic: testMessage.topic,
      message: {
        value: JSON.stringify(message)
      }
    })
    await waitJob()
    should.equal(errorLogs[0], `The message topic ${message.topic} doesn't match the Kafka topic ${testMessage.topic}.`)
  })

  for (const method of Object.keys(testMethods)) {
    const { testMessage, requiredFields, methodName } = testMethods[method]
    // Some fields are required for filtering in app.js
    const filteredRequiredFields = _.difference(requiredFields, ['topic', 'payload.resource',
      'payload.phaseTypeName', 'payload.state'])
    for (const requiredField of filteredRequiredFields) {
      it(`test ${methodName} message - invalid parameters, required field ${requiredField} is missing`, async () => {
        let message = _.cloneDeep(testMessage)
        message = _.omit(message, requiredField)
        await sendMessage(message)
        await waitJob()
        errorLogs.should.not.be.empty()
        assertErrorLogs(`"${_.last(requiredField.split('.'))}" is required`)
      })
    }

    it(`test ${methodName} message - invalid parameters, invalid timestamp`, async () => {
      let message = _.cloneDeep(testMessage)
      message.timestamp = 'invalid'
      await sendMessage(message)
      await waitJob()
      assertErrorLogs(`"timestamp" must be a number of milliseconds or valid date string`)
    })

    // If there is no topic, message cannot be processed
    for (const stringField of stringFields.filter(r => r !== 'topic')) {
      it(`test ${methodName} message - invalid parameters, invalid string type field ${stringField}`, async () => {
        let message = _.cloneDeep(testMessage)
        _.set(message, stringField, 123)
        await sendMessage(message)
        await waitJob()
        assertErrorLogs(`"${_.last(stringField.split('.'))}" must be a string`)
      })
    }
  }

  it(`Score aggregation should stop when reviews are not present in ES yet`, async () => {
    let message = _.cloneDeep(reviewCreateMessage)
    setPayloadField(message, 'submissionId', noESReviewId)
    await sendMessage(message)
    await waitJob()
    infoLogs.should.containEql('No reviews exist for aggregating')
    errorLogs.should.be.empty()
  })

  it(`Score aggregation should stop when there is only Screening and AV Scan reviews`, async () => {
    let message = _.cloneDeep(reviewCreateMessage)
    setPayloadField(message, 'submissionId', noValidReviewId)
    await sendMessage(message)
    await waitJob()
    infoLogs.should.containEql('No valid reviews exist for aggregating')
    errorLogs.should.be.empty()
  })

  it(`Score aggregation should succeed for review message with valid reviews`, async () => {
    await sendMessage(reviewCreateMessage)
    await waitJob()
    infoLogs.should.containEql('Creating new Review Summation')
    errorLogs.should.be.empty()
  })

  it(`Score aggregation should succeed for update review message with valid reviews`, async () => {
    await sendMessage(reviewUpdateMessage)
    await waitJob()
    infoLogs.should.containEql('Creating new Review Summation')
    errorLogs.should.be.empty()
  })

  it(`Appeals Respone aggregation should stop when there are no submissions`, async () => {
    let message = _.cloneDeep(appealsResponseClosureMessage)
    setPayloadField(message, 'projectId', noSubChallengeId)
    await sendMessage(message)
    await waitJob()
    infoLogs.should.containEql('No submissions present to aggregate review scores')
    errorLogs.should.be.empty()
  })

  it(`Appeals Respone aggregation should succeed when there are valid submissions with reviews`, async () => {
    await sendMessage(appealsResponseClosureMessage)
    await waitJob()
    infoLogs.should.containEql(`No reviews exist for ${noESReviewId}`)
    infoLogs.should.containEql(`No valid reviews exist for ${noValidReviewId}`)
    infoLogs.should.containEql('Creating new Review Summation')
    infoLogs.should.containEql('Updating existing Review Summation')
    errorLogs.should.be.empty()
  })
})
