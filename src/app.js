/**
 * The application entry point
 */

global.Promise = require('bluebird')
const _ = require('lodash')
const config = require('config')
const logger = require('./common/logger')
const Kafka = require('no-kafka')
const co = require('co')
const ProcessorService = require('./services/ProcessorService')
const healthcheck = require('topcoder-healthcheck-dropin')

// create consumer
const options = { connectionString: config.KAFKA_URL }
if (config.KAFKA_CLIENT_CERT && config.KAFKA_CLIENT_CERT_KEY) {
  options.ssl = { cert: config.KAFKA_CLIENT_CERT, key: config.KAFKA_CLIENT_CERT_KEY }
}
const consumer = new Kafka.SimpleConsumer(options)

const topics = [config.CREATE_DATA_TOPIC, config.UPDATE_DATA_TOPIC,
  config.AUTOPILOT_EVENT_TOPIC]

// data handler
const dataHandler = (messageSet, topic, partition) => Promise.each(messageSet, (m) => {
  const message = m.message.value.toString('utf8')
  logger.info(`Handle Kafka event message; Topic: ${topic}; Partition: ${partition}; Offset: ${
    m.offset}; Message: ${message}.`)
  let messageJSON
  try {
    messageJSON = JSON.parse(message)
  } catch (e) {
    logger.error('Invalid message JSON.')
    logger.error(e)
    // ignore the message
    return
  }
  // Check if the topic in the payload is same as the Kafka topic
  if (messageJSON.topic !== topic) {
    logger.error(`The message topic ${messageJSON.topic} doesn't match the Kafka topic ${topic}.`)
    // ignore the message
    return
  }
  // Process only message with resource as `review`
  if (messageJSON.topic !== config.AUTOPILOT_EVENT_TOPIC && messageJSON.payload.resource !== 'review') {
    logger.debug(`Ignoring non-review payloads from Topic: ${messageJSON.topic}`)
    // Ignore the message
    return
  }
  // Process only Appeals Response END state
  if (messageJSON.topic === config.AUTOPILOT_EVENT_TOPIC &&
    (messageJSON.payload.phaseTypeName !== 'Appeals Response' ||
    messageJSON.payload.state !== 'END')) {
    logger.debug(`Ignoring other auto pilot events from Topic: ${messageJSON.topic}`)
    // Ignore the message
    return
  }

  return co(function * () {
    if (topic === config.AUTOPILOT_EVENT_TOPIC) {
      yield ProcessorService.processEvent(messageJSON)
    } else {
      yield ProcessorService.processReview(messageJSON)
    }
  })
    // commit offset
    .then(() => consumer.commitOffset({ topic, partition, offset: m.offset }))
    .catch((err) => logger.error(err))
})

/*
 * Function to check if the Kafka connection is alive
 */
function check () {
  if (!consumer.client.initialBrokers && !consumer.client.initialBrokers.length) {
    return false
  }
  let connected = true
  consumer.client.initialBrokers.forEach(conn => {
    logger.debug(`url ${conn.server()} - connected=${conn.connected}`)
    connected = conn.connected & connected
  })
  return connected
}

consumer
  .init()
  // consume configured topics
  .then(() => {
    healthcheck.init([check]) // Topcoder health check plugin initialization
    _.each(topics, (tp) => consumer.subscribe(tp, { time: Kafka.LATEST_OFFSET }, dataHandler))
  })
  .catch((err) => logger.error(err))
