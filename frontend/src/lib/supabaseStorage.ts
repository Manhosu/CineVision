import { supabase } from './supabase';

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

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('O arquivo deve ter no máximo 10MB');
    }

    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomId}.${fileExtension}`;

    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Erro no upload: ${error.message}`);
    }

    // Construct public URL manually for public buckets
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;

    console.log('✅ Image uploaded successfully:', publicUrl);

    return {
      publicUrl,
      path: filePath,
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
