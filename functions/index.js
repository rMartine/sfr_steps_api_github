require('dotenv').config();
const functions = require('firebase-functions');
const firebase = require('firebase-admin');
const os = require('os');
const path = require('path');
const fs = require('fs');
const cors = require('cors')({ origin: true });
const Busboy = require('busboy');
const { Storage } = require('@google-cloud/storage');
const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_APPLICATION_CREDENTIALS,
});
const serviceAccount = require('./keys/firebase_private_key.json');
const firebaseApp = firebase.initializeApp(
  // functions.config().firebase
  {
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: 'https://safer-steps.firebaseio.com/'
  }
);
exports.photo = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    if (req.method !== 'POST') {
      return res.status(500).json({
        message: 'request rejected'
      });
    }

    const busboy = new Busboy({ headers: req.headers });
    let uploadData = null;

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const filepath = path.join(os.tmpdir(), filename);
      uploadData = { file: filepath, type: mimetype, token:filename.slice(0, -4) };
      file.pipe(fs.createWriteStream(filepath));
    });

    busboy.on('finish', () => {
      const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET_URL);
      bucket.upload(uploadData.file, {
        uploadType: 'media',
        metadata: {
          metadata: {
            contentType: uploadData.type,
            firebaseStorageDownloadTokens: uploadData.token
          }
        }
      })
      .then(() => {
        return res.status(200).json({
          message: 'success'
        });
      })
      .catch(err => {
        return res.status(500).json({
          error: err
        });
      });
    });
    busboy.end(req.rawBody);
  });
});

exports.answers = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    if (req.method !== 'POST') {
      return res.status(500).json({
        message: 'request rejected'
      });
    }
    try {
      firebase.database().ref('answers').child(req.headers.stairid).set(req.body);
      return res.status(200).json({
        message: 'success'
      });
    } catch(err) {
      console.log(err);
      return res.status(500).json({
        error: err
      });
    }
  });
});
