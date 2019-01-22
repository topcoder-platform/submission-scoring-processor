/**
 * Configuration file to be used while running tests
 */

module.exports = {
  AUTH0_URL: 'https://test.auth0.com/oauth/token',
  KAFKA_URL: process.env.TEST_KAFKA_URL || 'localhost:9092'
}
