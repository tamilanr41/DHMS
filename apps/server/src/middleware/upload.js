import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config/env.js';
import { ApiError } from '../utils/errors.js';

export const DATA_DIRS = {
  root: config.dataDir,
  uploads: path.join(config.dataDir, 'uploads'),
  branding: path.join(config.dataDir, 'branding'),
  backups: path.join(config.dataDir, 'backups'),
  documents: path.join(config.dataDir, 'documents'),
  photos: path.join(config.dataDir, 'photos'),
  consents: path.join(config.dataDir, 'consents')
};

export function ensureDataDirs() {
  for (const dir of Object.values(DATA_DIRS)) fs.mkdirSync(dir, { recursive: true });
}

function storageFor(dir) {
  return multer.diskStorage({
    destination(req, file, cb) {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    }
  });
}

const DOCUMENT_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
  'application/dicom', 'application/octet-stream'
]);

export const uploadDocument = multer({
  storage: storageFor(DATA_DIRS.documents),
  limits: { fileSize: config.uploadMaxMb * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!DOCUMENT_MIME.has(file.mimetype)) return cb(ApiError.badRequest('Unsupported file type'));
    cb(null, true);
  }
});

const PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadPatientPhoto = multer({
  storage: storageFor(DATA_DIRS.photos),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!PHOTO_MIME.has(file.mimetype)) return cb(ApiError.badRequest('Photo must be a JPEG, PNG or WebP image'));
    cb(null, true);
  }
});

// Clinical photos are kept apart from profile photos so the gallery can serve
// full-size images without touching avatar storage.
export const uploadClinicalPhoto = multer({
  storage: storageFor(DATA_DIRS.photos),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!PHOTO_MIME.has(file.mimetype)) return cb(ApiError.badRequest('Photo must be a JPEG, PNG or WebP image'));
    cb(null, true);
  }
});

export const uploadBrandingImage = multer({
  storage: storageFor(DATA_DIRS.branding),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      return cb(ApiError.badRequest('Logo/signature must be PNG, JPEG or WebP'));
    }
    cb(null, true);
  }
});
