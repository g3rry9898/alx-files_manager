#!/usr/bin/node
/**
 * Worker to process file-related jobs.
 */

const Queue = require('bull');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');
const path = require('path');
const dbClient = require('../utils/db');

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    return done(new Error('Missing fileId'));
  }

  if (!userId) {
    return done(new Error('Missing userId'));
  }

  const file = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectId(fileId), userId: new dbClient.ObjectId(userId) });

  if (!file) {
    return done(new Error('File not found'));
  }

  const sizes = [500, 250, 100];
  for (const size of sizes) {
    const thumbnail = await imageThumbnail(file.localPath, { width: size });
    const thumbnailPath = `${file.localPath}_${size}`;
    fs.writeFileSync(thumbnailPath, thumbnail);
  }

  done();
});

module.exports = fileQueue;

