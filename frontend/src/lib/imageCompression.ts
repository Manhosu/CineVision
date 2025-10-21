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

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              // Check if compressed size is acceptable
              const compressedSizeMB = blob.size / 1024 / 1024;

              if (compressedSizeMB > maxSizeMB) {
                // Try again with lower quality
                canvas.toBlob(
                  (blob2) => {
                    if (!blob2) {
                      reject(new Error('Failed to compress image'));
                      return;
                    }

                    const fileName = file.name.replace(/\.[^/.]+$/, '.jpg');
                    const compressedFile = new File([blob2], fileName, {
                      type: 'image/jpeg',
                      lastModified: Date.now(),
                    });

                    resolve(compressedFile);
                  },
                  'image/jpeg',
                  0.6 // Lower quality
                );
              } else {
                const fileName = file.name.replace(/\.[^/.]+$/, '.jpg');
                const compressedFile = new File([blob], fileName, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });

                resolve(compressedFile);
              }
            },
            'image/jpeg',
            0.85 // Initial quality
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
