/*
 * Test data to be used in tests
 */

const config = require('config')

const challengeId = 30001850
const noSubChallengeId = 40001850
const reviewId = 'd34d4180-65aa-42ec-a945-5fd21dec0501'
const noESReviewId = 'd34d4180-65aa-42ec-a945-5fd21dec0502'
const noValidReviewId = 'd34d4180-65aa-42ec-a945-5fd21dec0503'
const multiReviewSubmissionId = 'd34d4180-65aa-42ec-a945-5fd21dec0504'
const existReviewSummationId = 'b67d4180-65aa-42ec-a945-5fd21dec2351'

const reviewCreateMessage = {
  topic: config.CREATE_DATA_TOPIC,
  originator: 'submission-api',
  timestamp: '2018-02-03T00:00:00',
  'mime-type': 'application/json',
  payload: {
    resource: 'review',
    id: reviewId,
    submissionId: reviewId
  }
}

const reviewUpdateMessage = {
  topic: config.UPDATE_DATA_TOPIC,
  originator: 'submission-api',
  timestamp: '2018-02-03T00:00:00',
  'mime-type': 'application/json',
  payload: {
    resource: 'review',
    id: reviewId
  }
}

const appealsResponseClosureMessage = {
  topic: config.AUTOPILOT_EVENT_TOPIC,
  originator: 'submission-api',
  timestamp: '2018-02-03T00:00:00',
  'mime-type': 'application/json',
  payload: {
    projectId: challengeId,
    phaseId: 942767,
    phaseTypeName: 'Appeals Response',
    state: 'END'
  }
}

const messageRequiredFields = ['topic', 'originator', 'timestamp', 'mime-type']
const stringFields = ['topic', 'originator', 'mime-type']
const reviewPayloadRequiredFields = ['payload.resource', 'payload.id']
const eventPayloadRequiredFields = ['payload.projectId', 'payload.phaseTypeName', 'payload.state']

const testMethods = {
  'createReview': {
    methodName: 'processReview',
    requiredFields: [...messageRequiredFields, ...reviewPayloadRequiredFields],
    testMessage: reviewCreateMessage
  },
  'updateReview': {
    methodName: 'processReview',
    requiredFields: [...messageRequiredFields, ...reviewPayloadRequiredFields],
    testMessage: reviewUpdateMessage
  },
  'appealsResponseClosure': {
    methodName: 'processEvent',
    requiredFields: [...messageRequiredFields, ...eventPayloadRequiredFields],
    testMessage: appealsResponseClosureMessage
  }
}

const testReview = {
  id: reviewId,
  typeId: '68c5a381-c8ab-48af-92a7-7a869a4ee6c3',
  score: 100,
  reviewerId: '09798a0f-401b-4a16-afe8-039d9581e47c',
  submissionId: reviewId,
  scoreCardId: 30001851
}

const validReviews = [
  {
    id: reviewId,
    typeId: '68c5a381-c8ab-48af-92a7-7a869a4ee6c3',
    score: 100,
    reviewerId: '09798a0f-401b-4a16-afe8-039d9581e47c',
    submissionId: reviewId,
    scoreCardId: 30001851
  },
  {
    id: '12798a0f-401b-4a16-afe8-039d9581e47c',
    typeId: 'c56a4180-65aa-42ec-a945-5fd21dec0503',
    score: 95,
    reviewerId: '09798a0f-401b-4a16-afe8-039d9581e47c',
    submissionId: reviewId,
    scoreCardId: 30001852
  }
]

const multipleValidReviews = [
  {
    id: reviewId,
    typeId: '68c5a381-c8ab-48af-92a7-7a869a4ee6c3',
    score: 100,
    reviewerId: '09798a0f-401b-4a16-afe8-039d9581e47c',
    submissionId: multiReviewSubmissionId,
    scoreCardId: 30001851
  },
  {
    id: '12798a0f-401b-4a16-afe8-039d9581e47c',
    typeId: 'c56a4180-65aa-42ec-a945-5fd21dec0503',
    score: 92,
    reviewerId: '09798a0f-401b-4a16-afe8-039d9581e47c',
    submissionId: multiReviewSubmissionId,
    scoreCardId: 30001852
  },
  {
    id: '12798a0f-401b-4a16-afe8-039d9581e47d',
    typeId: 'c56a4180-65aa-42ec-a945-5fd21dec0503',
    score: 90,
    reviewerId: '09798a0f-401b-4a16-afe8-039d9581e47d',
    submissionId: multiReviewSubmissionId,
    scoreCardId: 30001852
  }
]

const singleReviewSummation = {
  aggregateScore: 95,
  isPassing: true,
  scoreCardId: 30001852,
  submissionId: reviewId
}

const multiReviewSummation = {
  aggregateScore: 91,
  isPassing: true,
  isFinal: true,
  scoreCardId: 30001852,
  submissionId: multiReviewSubmissionId
}

const reviewTypes = [
  {
    'name': 'Iterative Review',
    'id': 'c56a4180-65aa-42ec-a945-5fd21dec0505',
    'isActive': true
  },
  {
    'name': 'Appeals Response',
    'id': 'c56a4180-65aa-42ec-a945-5fd21dec0504',
    'isActive': true
  },
  {
    'name': 'AV Scan',
    'id': '68c5a381-c8ab-48af-92a7-7a869a4ee6c3',
    'isActive': true
  },
  {
    'name': 'Review',
    'id': 'c56a4180-65aa-42ec-a945-5fd21dec0503',
    'isActive': true
  },
  {
    'name': 'Screening',
    'id': 'c56a4180-65aa-42ec-a945-5fd21dec0501',
    'isActive': true
  },
  {
    'name': 'Checkpoint Review',
    'id': 'c56a4180-65aa-42ec-a945-5fd21dec0502',
    'isActive': true
  }
]

const submissions = [
  {
    id: noESReviewId
  },
  {
    id: noValidReviewId,
    review: [
      testReview
    ]
  },
  {
    id: reviewId,
    review: validReviews
  },
  {
    id: multiReviewSubmissionId,
    review: multipleValidReviews
  }
]

module.exports = {
  challengeId,
  noSubChallengeId,
  reviewId,
  noESReviewId,
  noValidReviewId,
  multiReviewSubmissionId,
  existReviewSummationId,
  reviewCreateMessage,
  reviewUpdateMessage,
  appealsResponseClosureMessage,
  stringFields,
  testMethods,
  testReview,
  validReviews,
  multipleValidReviews,
  singleReviewSummation,
  multiReviewSummation,
  reviewTypes,
  submissions
}
