/**
 * Service for Submission Scoring Processor
 */

const _ = require('lodash')
const joi = require('joi')
const logger = require('../common/logger')
const helper = require('../common/helper')
const config = require('config')

// Following Review types will be ignored while aggregating score
const REVIEW_TYPES_TO_IGNORE = ['Screening', 'AV Scan']
// TODO: Passing score should be dynamic according to the scorecard
const PASSING_SCORE = 80 // Hardcoded Passing score for the submission

/**
 * Process creation / update of Review
 * @param {Object} message the message
 */
function * processReview (message) {
  let submissionId
  let aggregateScore = 0

  if (message.payload.submissionId) { // If the Payload has submissionId
    submissionId = message.payload.submissionId
  } else {
    // Retrieve the review and fetch submissionId from review
    const review = yield helper.reqToSubmissionAPI('GET',
      `${config.SUBMISSION_API_URL}/reviews/${message.payload.id}`)
    submissionId = review.submissionId
  }
  // Get all reviews based on submissionId from Submission API
  const reviews = yield helper.reqToSubmissionAPI('GET',
    `${config.SUBMISSION_API_URL}/reviews?submissionId=${submissionId}`)

  if (reviews.length === 0) {
    logger.debug('No reviews exist for aggregating')
    return // Reviews not present in ES yet, stop processing
  }

  const reviewTypes = yield helper.getReviewTypes()

  // Find the number of valid reviews
  const validReviews = _.filter(reviews, (review) => {
    const reviewType = reviewTypes[review.typeId]
    if (!REVIEW_TYPES_TO_IGNORE.includes(reviewType)) {
      return true
    }
    return false
  })

  if (validReviews.length !== 0) {
    // TODO: weights for scores will change in future
    const validReviewWeight = reviews.length / validReviews.length

    _.each(reviews, (review) => {
      const reviewType = reviewTypes[review.typeId]
      if (!REVIEW_TYPES_TO_IGNORE.includes(reviewType)) {
        aggregateScore += validReviewWeight * review.score
      } else {
        aggregateScore += 0 * review.score
      }
    })

    aggregateScore = Math.ceil(aggregateScore / reviews.length * 10) / 10

    const isPassing = aggregateScore >= PASSING_SCORE

    const scoreCardId = yield helper.getScoreCardId(submissionId, validReviews)

    yield helper.processReviewSummation({
      scoreCardId: scoreCardId,
      submissionId: submissionId,
      aggregateScore: aggregateScore,
      isPassing: isPassing
    })
  } else {
    logger.debug('No valid reviews exist for aggregating')
  }
}

processReview.schema = {
  message: joi.object().keys({
    topic: joi.string().required(),
    originator: joi.string().required(),
    timestamp: joi.date().required(),
    'mime-type': joi.string().required(),
    payload: joi.object().keys({
      resource: joi.string().valid('review').required(),
      id: joi.string().required()
    }).unknown(true).required()
  }).required()
}

/**
 * Process Appeals Response Phase closure.
 * @param {Object} message the message
 */
function * processEvent (message) {
  // Get all submissions for a given challengeId
  const submissions = yield helper.reqToSubmissionAPI('GET',
    `${config.SUBMISSION_API_URL}/submissions?challengeId=${message.payload.projectId}`)
  // If there are submissions in the challenge, continue processing
  if (submissions.length !== 0) {
    // Get reviewTypes from Submission API
    const reviewTypes = yield helper.getReviewTypes()
    const promises = [] // Array of promises

    for (const i in submissions) {
      const submission = submissions[i]
      let aggregateScore = 0
      // Get the reviews attached with the submission
      if (submission.review) {
        const validReviews = _.filter(submission.review, (review) => {
          const reviewType = reviewTypes[review.typeId]
          if (!REVIEW_TYPES_TO_IGNORE.includes(reviewType)) {
            return true
          }
          return false
        })

        if (validReviews.length !== 0) {
          // TODO: weights for scores will change in future
          const validReviewWeight = submission.review.length / validReviews.length

          _.each(submission.review, (review) => {
            const reviewType = reviewTypes[review.typeId]
            if (!REVIEW_TYPES_TO_IGNORE.includes(reviewType)) {
              aggregateScore += validReviewWeight * review.score
            } else {
              aggregateScore += 0 * review.score
            }
          })

          aggregateScore = Math.ceil(aggregateScore / submission.review.length * 10) / 10

          const isPassing = aggregateScore >= PASSING_SCORE

          const scoreCardId = yield helper.getScoreCardId(submission.id, validReviews)

          promises.push(
            yield helper.processReviewSummation({
              scoreCardId: scoreCardId,
              submissionId: submission.id,
              aggregateScore: aggregateScore,
              isPassing: isPassing,
              isFinal: true
            })
          )
        }
      }
    }
    // Wait until all review summation is processed
    yield promises
  } else {
    logger.debug('No submissions present to aggregate review scores')
  }
}

processEvent.schema = {
  message: joi.object().keys({
    topic: joi.string().required(),
    originator: joi.string().required(),
    timestamp: joi.date().required(),
    'mime-type': joi.string().required(),
    payload: joi.object().keys({
      projectId: joi.alternatives().try(joi.number().integer().min(1), joi.string().uuid()).required(),
      phaseTypeName: joi.string().required(),
      state: joi.string().required()
    }).unknown(true).required()
  }).required()
}

// Exports
module.exports = {
  processReview,
  processEvent
}

logger.buildService(module.exports)
