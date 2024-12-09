#!/usr/bin/node
/**
 * FilesController to handle file-related endpoints.
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    const key = `auth_${token}`;

    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const newFile = {
      userId: new dbClient.ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : new dbClient.ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(newFile);
      return res.status(201).json({ id: result.insertedId, ...newFile });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const localPath = path.join(folderPath, uuidv4());
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

    newFile.localPath = localPath;
    const result = await dbClient.db.collection('files').insertOne(newFile);
    return res.status(201).json({ id: result.insertedId, ...newFile });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    const key = `auth_${token}`;

    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectId(fileId), userId: new dbClient.ObjectId(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const key = `auth_${token}`;

    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = 0, page = 0 } = req.query;
    const files = await dbClient.db.collection('files')
      .aggregate([
        { $match: { parentId: parentId === 0 ?
