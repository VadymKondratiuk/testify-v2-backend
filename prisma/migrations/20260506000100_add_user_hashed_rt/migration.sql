-- Refresh token зберігаємо тільки у вигляді bcrypt-хешу.
ALTER TABLE "User" ADD COLUMN "hashedRt" TEXT;
