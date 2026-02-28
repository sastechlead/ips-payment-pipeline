const { Kafka } = require('kafkajs');
require('dotenv').config();

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

// Consumer only — notification service is end of pipeline, no need to publish
const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'notification-service-group',
});

module.exports = { consumer };
