import { supabase } from './supabase';
import { compressImage, needsCompression } from './imageCompression';

export interface ImageUploadResult {
  publicUrl: string;
  path: string;
  error?: string;
}

/**
 * Upload an image to Supabase Storage
 * @param file - The image file to upload
 * @param bucket - The storage bucket name (default: 'cinevision-capas')
 * @param folder - Optional folder path within the bucket (e.g., 'posters', 'backdrops')
 * @returns Upload result with public URL or error
 */
export async function uploadImageToSupabase(
  file: File,
  bucket: string = 'cinevision-capas',
  folder?: string
): Promise<ImageUploadResult> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('O arquivo deve ser uma imagem');
    }

    // Compress image if it's too large (> 2MB)
    let fileToUpload = file;
    if (needsCompression(file, 2)) {
      console.log(`📦 Compressing image from ${(file.size / 1024 / 1024).toFixed(2)}MB...`);
      fileToUpload = await compressImage(file, 2, 2000);
      console.log(`✅ Compressed to ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
    }

    // Validate compressed file size (max 10MB as fallback)
    if (fileToUpload.size > 10 * 1024 * 1024) {
      throw new Error('O arquivo deve ter no máximo 10MB');
    }

    // Create FormData to send to API route
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('bucket', bucket);
    if (folder) {
      formData.append('folder', folder);
    }

    // Upload via API route (which uses service role key)
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro no upload');
    }

    const data = await response.json();

    console.log('✅ Image uploaded successfully:', data.publicUrl);

    return {
      publicUrl: data.publicUrl,
      path: data.path,
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    return {
      publicUrl: '',
      path: '',
      error: error.message || 'Erro desconhecido no upload',
    };
  }
}

/**
 * Delete an image from Supabase Storage
 * @param path - The file path in storage
 * @param bucket - The storage bucket name
 */
export async function deleteImageFromSupabase(
  path: string,
  bucket: string = 'cinevision-capas'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Delete error:', error);
    return {
      success: false,
      error: error.message || 'Erro ao deletar imagem',
    };
  }
}
