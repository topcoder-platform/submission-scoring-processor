/**
 * Test cases for Processor Service
 */
const _ = require('lodash')
const should = require('should')
const sinon = require('sinon')

const processorService = require('../../src/services/ProcessorService')
const helper = require('../../src/common/helper')
const logger = require('../../src/common/logger')

const {
  stringFields, testMethods, noSubChallengeId,
  reviewCreateMessage, reviewUpdateMessage, singleReviewSummation,
  appealsResponseClosureMessage, noESReviewId, noValidReviewId,
  multiReviewSummation
} = require('../common/testData')

describe('Submission Scoring Processor Unit Tests', () => {
  const infoLogs = []
  const errorLogs = []
  const info = logger.info
  const error = logger.error

  /**
   * Assert validation error
   * @param err the error to validate
   * @param message the error message
   */
  const assertValidationError = (err, message) => {
    err.isJoi.should.be.true()
    should.equal(err.name, 'ValidationError')
    err.details.map(x => x.message).should.containEql(message)
    errorLogs.should.not.be.empty()
    errorLogs.should.containEql(err.stack)
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

  before(() => {
    // inject logger with log collector
    logger.info = (message) => {
      infoLogs.push(message)
      info(message)
    }
    logger.error = (message) => {
      errorLogs.push(message)
      error(message)
    }
  })

  beforeEach(() => {
    // clear logs
    infoLogs.length = 0
    errorLogs.length = 0
  })

  after(() => {
    // restore logger
    logger.error = error
    logger.info = info
  })

  for (const method of Object.keys(testMethods)) {
    const { testMessage, requiredFields, methodName } = testMethods[method]
    for (const requiredField of requiredFields) {
      it(`test ${methodName} message - invalid parameters, required field ${requiredField} is missing`, async () => {
        let message = _.cloneDeep(testMessage)
        message = _.omit(message, requiredField)
        try {
          await processorService[methodName](message)
          throw new Error(`Should throw error for missing required field "${_.last(requiredField.split('.'))}"`)
        } catch (err) {
          assertValidationError(err, `"${_.last(requiredField.split('.'))}" is required`)
        }
      })
    }

    it(`test ${methodName} message - invalid parameters, invalid timestamp`, async () => {
      let message = _.cloneDeep(testMessage)
      message.timestamp = 'invalid'
      try {
        await processorService[methodName](message)
        throw new Error('Should throw error for invalid timestamp field')
      } catch (err) {
        assertValidationError(err, `"timestamp" must be a number of milliseconds or valid date string`)
      }
    })

    for (const stringField of stringFields) {
      it(`test ${methodName} message - invalid parameters, invalid string type field ${stringField}`, async () => {
        let message = _.cloneDeep(testMessage)
        _.set(message, stringField, 123)
        try {
          await processorService[methodName](message)
          throw new Error(`Should throw error for invalid string field "${_.last(stringField.split('.'))}"`)
        } catch (err) {
          assertValidationError(err, `"${_.last(stringField.split('.'))}" must be a string`)
        }
      })
    }
  }

  it(`Score aggregation should stop when reviews are not present in ES yet`, async () => {
    let message = _.cloneDeep(reviewCreateMessage)
    setPayloadField(message, 'submissionId', noESReviewId)
    await processorService['processReview'](message)
    infoLogs.should.containEql('No reviews exist for aggregating')
    errorLogs.should.be.empty()
  })

  it(`Score aggregation should stop when there is only Screening and AV Scan reviews`, async () => {
    let message = _.cloneDeep(reviewCreateMessage)
    setPayloadField(message, 'submissionId', noValidReviewId)
    await processorService['processReview'](message)
    infoLogs.should.containEql('No valid reviews exist for aggregating')
    errorLogs.should.be.empty()
  })

  it(`Score aggregation should succeed for review message with valid reviews`, async () => {
    const helperSpy = sinon.spy(helper, 'processReviewSummation')
    await processorService['processReview'](reviewCreateMessage)
    helperSpy.restore()
    // Verify the Payload posted to Review Summation End point
    sinon.assert.calledWith(helperSpy, singleReviewSummation)
    errorLogs.should.be.empty()
  })

  it(`Score aggregation should succeed for update review message with valid reviews`, async () => {
    const helperSpy = sinon.spy(helper, 'processReviewSummation')
    await processorService['processReview'](reviewUpdateMessage)
    helperSpy.restore()
    // Verify the Payload posted to Review Summation End point
    sinon.assert.calledWith(helperSpy, singleReviewSummation)
    infoLogs.should.containEql('Creating new Review Summation')
    errorLogs.should.be.empty()
  })

  it(`Appeals Respone aggregation should stop when there are no submissions`, async () => {
    let message = _.cloneDeep(appealsResponseClosureMessage)
    setPayloadField(message, 'projectId', noSubChallengeId)
    await processorService['processEvent'](message)
    infoLogs.should.containEql('No submissions present to aggregate review scores')
    errorLogs.should.be.empty()
  })

  it(`Appeals Respone aggregation should succeed when there are valid submissions with reviews`, async () => {
    const helperSpy = sinon.spy(helper, 'processReviewSummation')
    await processorService['processEvent'](appealsResponseClosureMessage)
    helperSpy.restore()
    // Verify the Payload posted to Review Summation End point
    sinon.assert.calledWith(helperSpy, multiReviewSummation)
    infoLogs.should.containEql(`No reviews exist for ${noESReviewId}`)
    infoLogs.should.containEql(`No valid reviews exist for ${noValidReviewId}`)
    infoLogs.should.containEql('Creating new Review Summation')
    infoLogs.should.containEql('Updating existing Review Summation')
    errorLogs.should.be.empty()
  })
})
