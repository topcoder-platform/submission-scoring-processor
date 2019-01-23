/**
 * Contains generic helper methods
 */

const config = require('config')
const _ = require('lodash')
const logger = require('./logger')
const request = require('superagent')
const m2mAuth = require('tc-core-library-js').auth.m2m
const m2m = m2mAuth(_.pick(config, ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME']))

// Variable to cache reviewTypes from Submission API
const reviewTypes = {}
// Variable to cache scoreCardIds from Challenge API
const scoreCardIds = {}

/* Function to get M2M token
 * @returns {Promise}
 */
const getM2Mtoken = async () => {
  return m2m.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
}

/**
 * Function to send request to Submission API
 * @param{String} reqType Type of the request POST / PATCH
 * @param(String) path Complete path of the Submission API URL
 * @param{Object} reqBody Body of the request
 * @returns {Promise}
 */
const reqToSubmissionAPI = async (reqType, path, reqBody) => {
  // Token necessary to send request to Submission API
  const token = await getM2Mtoken()
  if (reqType === 'POST') {
    // Post the request body to Submission API
    await request
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(reqBody)
  } else if (reqType === 'PUT') {
    // Put the request body to Submission API
    await request
      .put(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(reqBody)
  } else if (reqType === 'PATCH') {
    // Patch the request body to Submission API
    await request
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(reqBody)
  } else if (reqType === 'GET') {
    // GET the requested URL from Submission API
    const response = await request
      .get(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
    if (response.body) {
      return response.body
    } else {
      return null
    }
  }
}

/*
 * Function to get reviewTypes from Submission API
 * @returns {Object} Review types pushed into a Dictionary
 */
const getReviewTypes = async () => {
  if (Object.keys(reviewTypes).length !== 0) {
    return reviewTypes
  } else {
    const response = await reqToSubmissionAPI('GET',
      `${config.SUBMISSION_API_URL}/reviewTypes`, {})
    _.each(response, (value) => {
      reviewTypes[value.id] = value.name
    })
    return reviewTypes
  }
}

/*
 * Get scorecard ID of a challenge from Challenge API
 * @param submissionId Submission ID
 * @param reviews Valid reviews of the given submissionId
 * @returns {String} ScorecardId of the challenge
 */
const getScoreCardId = async (submissionId, reviews) => {
  let scoreCardId
  let response
  // Retrieve submission from Submission API
  const submission = await reqToSubmissionAPI('GET',
    `${config.SUBMISSION_API_URL}/submissions/${submissionId}`)
  // Fetch the challenge information from Challenge API
  if (submission.challengeId) {
    // Return the scoreCardId if it's already cached
    if (scoreCardIds[submission.challengeId]) {
      return scoreCardIds[submission.challengeId]
    }
    try {
      response = await request.get(`${config.CHALLENGE_API_URL}/${submission.challengeId}`)
    } catch (ex) {
      logger.error(`Error while accessing ${config.CHALLENGE_API_URL}/${submission.challengeId}`)
    }
  }

  if (response) {
    logger.debug('Populating ScorecardId from Challenge API')
    scoreCardId = response.body.result.content.reviewScorecardId
    scoreCardIds[submission.challengeId] = scoreCardId
  } else {
    logger.debug('Populating ScorecardId from valid reviews')
    scoreCardId = reviews[0].scoreCardId
  }
  return scoreCardId
}

/*
 * Create / Update reviewSummation as required
 * @param reviewSummation Current reviewSummation object
 * @returns {Promise}
 */
const processReviewSummation = async (reviewSummation) => {
  // Retrieve existing review summation from Submission API if any
  const extReviewSummation = await reqToSubmissionAPI('GET',
    `${config.SUBMISSION_API_URL}/reviewSummations?submissionId=${reviewSummation.submissionId}`)
  // If Review summation exist already, Update it else create new reviewSummation
  if (extReviewSummation.length !== 0) {
    logger.info('Updating existing Review Summation')
    return reqToSubmissionAPI('PUT',
      `${config.SUBMISSION_API_URL}/reviewSummations/${extReviewSummation[0].id}`, reviewSummation)
  } else {
    logger.info('Creating new Review Summation')
    return reqToSubmissionAPI('POST',
      `${config.SUBMISSION_API_URL}/reviewSummations`, reviewSummation)
  }
}

module.exports = {
  reqToSubmissionAPI,
  getReviewTypes,
  getScoreCardId,
  processReviewSummation
}
