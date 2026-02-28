const { Kafka } = require('kafkajs');
require('dotenv').config();

const kafka = new Kafka({
  clientId: 'validation-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

const producer = kafka.producer();

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'validation-service-group',
});

module.exports = { producer, consumer };
