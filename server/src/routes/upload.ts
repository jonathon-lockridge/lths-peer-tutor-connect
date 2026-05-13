import { Router, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";

export const uploadRouter = Router();

const USE_S3 = Boolean(process.env.S3_BUCKET_NAME);

const s3 = USE_S3
  ? new S3Client({
      region: "auto",
      endpoint: process.env.S3_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
if (!USE_S3 && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const upload = multer({
  storage: USE_S3
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
        },
      }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only images (JPEG, PNG, WebP, GIF) and PDFs are allowed"));
    }
  },
});

uploadRouter.use(requireAuth);

uploadRouter.post(
  "/",
  upload.single("file"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError(400, "No file provided");

      if (USE_S3 && s3) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          })
        );

        const url = `${process.env.S3_PUBLIC_URL}/${key}`;
        res.json({ success: true, data: { url, filename: req.file.originalname } });
      } else {
        const url = `/api/uploads/${req.file.filename}`;
        res.json({ success: true, data: { url, filename: req.file.originalname } });
      }
    } catch (err) {
      next(err);
    }
  }
);
