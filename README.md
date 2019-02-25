# Topcoder - Submission Scoring Processor 

### Dependencies

- nodejs https://nodejs.org/en/ (v8+)
- Kafka
- Docker, Docker Compose (Only for deployment with Docker)

## Configuration

Configuration of the Submission Scoring Processor is at `config/default.js`.
The following parameters can be set in config files or in env variables:

- LOG_LEVEL: the log level; default value: 'debug'
- KAFKA_URL: comma separated Kafka hosts; default value: 'localhost:9092'
- KAFKA_CLIENT_CERT: Kafka connection certificate, optional; default value is undefined;
    if not provided, then SSL connection is not used, direct insecure connection is used;
    if provided, it can be either path to certificate file or certificate content
- KAFKA_CLIENT_CERT_KEY: Kafka connection private key, optional; default value is undefined;
    if not provided, then SSL connection is not used, direct insecure connection is used;
    if provided, it can be either path to private key file or private key content
- CREATE_DATA_TOPIC: create data Kafka topic, default value is 'submission.notification.create'
- UPDATE_DATA_TOPIC: update data Kafka topic, default value is 'submission.notification.update'
- AUTOPILOT_EVENT_TOPIC: Auto Pilot event Kafka topic, default value is 'notifications.autopilot.events'
- SUBMISSION_API_URL: The Submission API URL, default value is 'http://localhost:3000/api/v5'
- CHALLENGE_API_URL: The Challenge API URL, default value is 'https://api.topcoder-dev.com/v3/challenges'

Also note that there is a `/health` endpoint that checks for the health of the app. This sets up an expressjs server and listens on the environment variable `PORT`. It's not part of the configuration file and needs to be passed as an environment variable

## Local Kafka setup

- `http://kafka.apache.org/quickstart` contains details to setup and manage Kafka server,
  below provides details to setup Kafka server in Mac, Windows will use bat commands in bin/windows instead
- download kafka at `https://www.apache.org/dyn/closer.cgi?path=/kafka/1.1.0/kafka_2.11-1.1.0.tgz`
- extract out the downloaded tgz file
- go to the extracted directory kafka_2.11-0.11.0.1
- start ZooKeeper server:
  `bin/zookeeper-server-start.sh config/zookeeper.properties`
- use another terminal, go to same directory, start the Kafka server:
  `bin/kafka-server-start.sh config/server.properties`
- note that the zookeeper server is at localhost:2181, and Kafka server is at localhost:9092
- use another terminal, go to same directory, create some topics:
```  
  bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic submission.notification.create
  bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic submission.notification.update
  bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic notifications.autopilot.events
```
- verify that the topics are created:
  `bin/kafka-topics.sh --list --zookeeper localhost:2181`,
  it should list out the created topics
- run the producer and then write some message into the console to send to the topic `submission.notification.create`:
  `bin/kafka-console-producer.sh --broker-list localhost:9092 --topic submission.notification.create`
- In the console, write some message, one message per line:
E.g.
```
  { "topic":"submission.notification.create", "originator":"submission-api", "timestamp":"2018-08-06T15:46:05.575Z", "mime-type":"application/json", "payload":{ "resource":"review", "id": "d34d4180-65aa-42ec-a945-5fd21dec0502", "score": 92.0, "typeId": "c56a4180-65aa-42ec-a945-5fd21dec0501", "reviewerId": "c23a4180-65aa-42ec-a945-5fd21dec0503", "scoreCardId": "b25a4180-65aa-42ec-a945-5fd21dec0503", "submissionId": "a12a4180-65aa-42ec-a945-5fd21dec0501", "created": "2018-05-20T07:00:30.123Z", "updated": "2018-06-01T07:36:28.178Z", "createdBy": "admin", "updatedBy": "admin" } }
```
- optionally, use another terminal, go to same directory, start a consumer to view the messages:
```
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic submission.notification.create --from-beginning
```
- writing/reading messages to/from other topics are similar

## Local deployment

1. From the project root directory, run the following command to install the dependencies

```
npm i
```

2. To run linters if required

```
npm run lint

npm run lint:fix # To fix possible lint errors
```

3. Start the processor

```
npm start
```

## Local Deployment with Docker

To run the Submission Scoring Processor using docker, follow the below steps

1. Navigate to the directory `docker`

2. Rename the file `sample.api.env` to `api.env`

3. Set the required AWS credentials in the file `api.env`

4. Once that is done, run the following command

```
docker-compose up
```

5. When you are running the application for the first time, It will take some time initially to download the image and install the dependencies

## Unit and E2E tests

Variables related to tests is present in `config/test.js`

1. AUTH0_URL - Can leave the dummy value in config/test.js as it is, As no real API requests are triggered during tests
2. TEST_KAFKA_URL - Kafka URL to be used for tests, this could be different from the Kafka instance used for development

#### Running unit tests and coverage

To run unit tests alone

```
npm run test
```

To run unit tests with coverage report

```
npm run cov
```

#### Running E2E tests and coverage

To run e2e tests alone

```
npm run e2e
```

To run e2e tests with coverage report

```
npm run cov-e2e
```

## Verification

For Verification with test data, Please use the branch `Issue_1` from Submission API (https://github.com/sharathkumaranbu/submissions-api/tree/Issue_1) and ensure to load test data in ES and DynamoDB before proceeding

Commands to load test data in DynamoDB and ES (From Submission API)
```
npm run init-db
npm run init-es
```

1. Ensure that Kafka is up and running and the topics `submission.notification.create, submission.notification.update and notifications.autopilot.events` are created in Kafka

2. Attach to the topic `submission.notification.create` using Kafka console producer

```
bin/kafka-console-producer.sh --broker-list localhost:9092 --topic submission.notification.create
```

3. Write the following message to the Console

```
{ "topic":"submission.notification.create", "originator":"submission-api", "timestamp":"2018-08-06T15:46:05.575Z", "mime-type":"application/json", "payload":{ "resource":"review", "id": "d34d4180-65aa-42ec-a945-5fd21dec0502", "score": 92.0, "typeId": "c56a4180-65aa-42ec-a945-5fd21dec0501", "reviewerId": "c23a4180-65aa-42ec-a945-5fd21dec0503", "scoreCardId": "b25a4180-65aa-42ec-a945-5fd21dec0503", "submissionId": "a12a4180-65aa-42ec-a945-5fd21dec0501", "created": "2018-05-20T07:00:30.123Z", "updated": "2018-06-01T07:36:28.178Z", "createdBy": "admin", "updatedBy": "admin" } }
```

4. To find the data used for testing, refer to `scripts/data` directory in Submission API

4. You could check the final result in the Submission API console or in DynamoDB. 

5. For the above payload (submissionId = a12a4180-65aa-42ec-a945-5fd21dec0501), there will be 1 screening review and 1 review. While calculating aggregated score, screening review and review from AV Scan will be ignored. Aggregated score will be calculated based on valid review

6. Attach to the topic `submission.notifcation.update` using Kafka console producer and write the below message

```
{ "topic":"submission.notification.update", "originator":"submission-api", "timestamp":"2018-08-06T15:46:05.575Z", "mime-type":"application/json", "payload":{ "resource":"review", "id": "d24d4180-65aa-42ec-a945-5fd21dec0503", "score": 80.83, "updatedBy": "test" } }
```

7. Submission related to the above reviewId will be fetched and processed. Corresponding submission has 2 valid reviews and 1 AV Scan review. AV Scan review will be ignored while calculating aggregated score

8. To test the events happening during Appeals Response closure, attach to the topics `notifications.autopilot.events` and write the below message

```
{ "topic":"notifications.autopilot.events", "originator":"project-api", "timestamp":"2018-08-06T15:46:05.575Z", "mime-type":"application/json", "payload":{ "projectId": "c3564180-65aa-42ec-a945-5fd21dec0503", "phaseId": 942767, "phaseTypeName": "Appeals Response", "state": "END" } }
```

9. There will be 3 submissions for the above challenge, One submission will have only AV Scan review, hence it will be ignored and for other submissions reviewSummation will be processed

10. Some other payload for testing

```
## For the below challenge, scorecardId will be fetched from Challenge API

{ "topic":"notifications.autopilot.events", "originator":"project-api", "timestamp":"2018-08-06T15:46:05.575Z", "mime-type":"application/json", "payload":{ "projectId": 30051825, "phaseId": 942767, "phaseTypeName": "Appeals Response", "state": "END" } }


## Below payloads will be ignored because only Appeals Response end will be processed

{ "topic":"notifications.autopilot.events", "originator":"project-api", "timestamp":"2018-08-06T15:46:05.575Z", "mime-type":"application/json", "payload":{ "projectId": 30051825, "phaseId": 942767, "phaseTypeName": "Appeals Response", "state": "Start" } }

{ "topic":"notifications.autopilot.events", "originator":"project-api", "timestamp":"2018-08-06T15:46:05.575Z", "mime-type":"application/json", "payload":{ "projectId": 30051825, "phaseId": 942767, "phaseTypeName": "Review", "state": "END" } }
```
