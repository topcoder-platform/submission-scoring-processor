/*
 * Setting up Mock for tests
 */

// During test the env variable is set to test
process.env.NODE_ENV = 'test'

const _ = require('lodash')
const config = require('config')
const nock = require('nock')
const prepare = require('mocha-prepare')
const URL = require('url')

const {
  challengeId, reviewId, noESReviewId, noValidReviewId,
  testReview, reviewTypes, validReviews, noSubChallengeId,
  submissions, multiReviewSubmissionId, multipleValidReviews,
  multiReviewSummation, existReviewSummationId
} = require('./testData')

prepare((done) => {
  // called before loading of test cases
  nock(/.com/)
    .persist()
    .post(URL.parse(config.AUTH0_URL).path)
    .reply(200, { access_token: 'test' })
    .get(URL.parse(`${config.SUBMISSION_API_URL}/reviewTypes`).path)
    .reply(200, reviewTypes)
    .get(URL.parse(`${config.SUBMISSION_API_URL}/reviews/${reviewId}`).path)
    .reply(200, testReview)
    .get(URL.parse(`${config.SUBMISSION_API_URL}/reviews?submissionId=${reviewId}`).path)
    .reply(200, validReviews)
    .get(URL.parse(`${config.SUBMISSION_API_URL}/reviews?submissionId=${noESReviewId}`).path)
    .reply(200, [])
    .get(URL.parse(`${config.SUBMISSION_API_URL}/reviews?submissionId=${noValidReviewId}`).path)
    .reply(200, [testReview])
    .get(URL.parse(`${config.SUBMISSION_API_URL}/submissions/${reviewId}`).path)
    .reply(200, { challengeId })
    .get(URL.parse(`${config.CHALLENGE_API_URL}/${challengeId}`).path)
    .reply(200, { result: { content: { reviewScorecardId: 30001852 } } })
    .get(URL.parse(`${config.SUBMISSION_API_URL}/reviewSummations?submissionId=${reviewId}`).path)
    .reply(200, [])
    .post(URL.parse(`${config.SUBMISSION_API_URL}/reviewSummations`).path)
    .reply(200)
    .get(URL.parse(`${config.SUBMISSION_API_URL}/submissions?challengeId=${noSubChallengeId}`).path)
    .reply(200, [])
    .get(URL.parse(`${config.SUBMISSION_API_URL}/submissions?challengeId=${challengeId}`).path)
    .reply(200, submissions)
    .get(URL.parse(`${config.SUBMISSION_API_URL}/submissions/${multiReviewSubmissionId}`).path)
    .reply(200, multipleValidReviews)
    .get(URL.parse(`${config.SUBMISSION_API_URL}/reviewSummations?submissionId=${multiReviewSubmissionId}`).path)
    .reply(200, [_.extend({ id: existReviewSummationId }, multiReviewSummation)])
    .put(URL.parse(`${config.SUBMISSION_API_URL}/reviewSummations/${existReviewSummationId}`).path)
    .reply(200)
  done()
}, (done) => {
  // called after all test completes (regardless of errors)
  nock.cleanAll()
  done()
})
