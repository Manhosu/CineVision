/**
 * Compress an image file to reduce its size
 * Uses Canvas API to resize and compress images
 */
export async function compressImage(
  file: File,
  maxSizeMB: number = 2,
  maxWidthOrHeight: number = 2000
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read file'));

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => reject(new Error('Failed to load image'));

      img.onload = () => {
        try {
          // Calculate new dimensions
          let { width, height } = img;

          if (width > height && width > maxWidthOrHeight) {
            height = (height * maxWidthOrHeight) / width;
            width = maxWidthOrHeight;
          } else if (height > maxWidthOrHeight) {
            width = (width * maxWidthOrHeight) / height;
            height = maxWidthOrHeight;
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Igor (13/07): preserva PNG. Antes convertia sempre pra JPEG
          // (destrói alpha do logo). Se input é image/png, mantém .png +
          // toBlob sem quality (PNG é lossless). Outros formatos vão pro
          // caminho antigo (JPEG 0.85 → 0.6 se ainda grande).
          const isPng = file.type === 'image/png';
          const outMime = isPng ? 'image/png' : 'image/jpeg';
          const outExt = isPng ? '.png' : '.jpg';

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              // Check if compressed size is acceptable
              const compressedSizeMB = blob.size / 1024 / 1024;

              if (compressedSizeMB > maxSizeMB && !isPng) {
                // Try again with lower quality (JPEG only — PNG não tem quality)
                canvas.toBlob(
                  (blob2) => {
                    if (!blob2) {
                      reject(new Error('Failed to compress image'));
                      return;
                    }

                    const fileName = file.name.replace(/\.[^/.]+$/, outExt);
                    const compressedFile = new File([blob2], fileName, {
                      type: outMime,
                      lastModified: Date.now(),
                    });

                    resolve(compressedFile);
                  },
                  'image/jpeg',
                  0.6 // Lower quality
                );
              } else {
                const fileName = file.name.replace(/\.[^/.]+$/, outExt);
                const compressedFile = new File([blob], fileName, {
                  type: outMime,
                  lastModified: Date.now(),
                });

                resolve(compressedFile);
              }
            },
            outMime,
            isPng ? undefined : 0.85 // PNG lossless — quality param ignorado
          );
        } catch (error) {
          reject(error);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Check if image compression is needed
 */
export function needsCompression(file: File, maxSizeMB: number = 2): boolean {
  const sizeMB = file.size / 1024 / 1024;
  return sizeMB > maxSizeMB;
}
