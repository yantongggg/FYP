import os
import uuid
from datetime import datetime
import logging
from supabase import create_client
from utils.supabase_client import supabase_client

logger = logging.getLogger(__name__)

class SupabaseStorage:
    """Utility class for handling Supabase Storage operations"""
    
    @staticmethod
    def upload_file(bucket_name: str, file_data: bytes, file_name: str, user_id: str, content_type: str = 'image/jpeg'):
        """
        Upload file to Supabase Storage
        
        Args:
            bucket_name: Name of the storage bucket
            file_data: Binary file data
            file_name: Name of the file
            user_id: User ID for folder organization
            content_type: MIME type of the file
            
        Returns:
            dict: Upload result with file URL or error
        """
        try:
            # Create unique file path with user folder
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            unique_filename = f"{timestamp}_{uuid.uuid4().hex[:8]}_{file_name}"
            file_path = f"{user_id}/{unique_filename}"
            
            # Upload file to Supabase Storage
            result = supabase_client.storage.from_(bucket_name).upload(
                path=file_path,
                file=file_data,
                file_options={
                    'content-type': content_type,
                    'cache-control': '3600'
                }
            )
            
            if result.get('error'):
                logger.error(f"Storage upload error: {result['error']}")
                return {
                    'success': False,
                    'error': result['error']
                }
            
            # Get public URL
            public_url = supabase_client.storage.from_(bucket_name).get_public_url(file_path)
            
            logger.info(f"File uploaded successfully: {file_path}")
            
            return {
                'success': True,
                'file_path': file_path,
                'public_url': public_url,
                'bucket': bucket_name
            }
            
        except Exception as e:
            logger.error(f"Error uploading file to storage: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def delete_file(bucket_name: str, file_path: str):
        """
        Delete file from Supabase Storage
        
        Args:
            bucket_name: Name of the storage bucket
            file_path: Path to the file in storage
            
        Returns:
            dict: Deletion result
        """
        try:
            result = supabase_client.storage.from_(bucket_name).remove([file_path])
            
            if result.get('error'):
                logger.error(f"Storage deletion error: {result['error']}")
                return {
                    'success': False,
                    'error': result['error']
                }
            
            logger.info(f"File deleted successfully: {file_path}")
            
            return {
                'success': True,
                'message': 'File deleted successfully'
            }
            
        except Exception as e:
            logger.error(f"Error deleting file from storage: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def get_file_url(bucket_name: str, file_path: str):
        """
        Get public URL for a file in Supabase Storage
        
        Args:
            bucket_name: Name of the storage bucket
            file_path: Path to the file in storage
            
        Returns:
            str: Public URL of the file
        """
        try:
            public_url = supabase_client.storage.from_(bucket_name).get_public_url(file_path)
            return public_url
            
        except Exception as e:
            logger.error(f"Error getting file URL: {str(e)}")
            return None
    
    @staticmethod
    def list_user_files(bucket_name: str, user_id: str):
        """
        List all files for a specific user
        
        Args:
            bucket_name: Name of the storage bucket
            user_id: User ID to filter files
            
        Returns:
            list: List of user files
        """
        try:
            result = supabase_client.storage.from_(bucket_name).list(user_id)
            
            if result.get('error'):
                logger.error(f"Storage list error: {result['error']}")
                return []
            
            return result.get('data', [])
            
        except Exception as e:
            logger.error(f"Error listing user files: {str(e)}")
            return []

class BiometricStorage:
    """Specialized storage utilities for biometric data"""
    
    @staticmethod
    def store_face_image(user_id: str, image_data: bytes, image_type: str = 'capture'):
        """
        Store face image in face-captures bucket
        
        Args:
            user_id: User ID
            image_data: Binary image data
            image_type: Type of image (capture, verification, etc.)
            
        Returns:
            dict: Storage result
        """
        file_name = f"face_{image_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.jpg"
        
        return SupabaseStorage.upload_file(
            bucket_name='face-captures',
            file_data=image_data,
            file_name=file_name,
            user_id=user_id,
            content_type='image/jpeg'
        )
    
    @staticmethod
    def store_ekyc_document(user_id: str, document_data: bytes, document_type: str):
        """
        Store eKYC document in ekyc-documents bucket
        
        Args:
            user_id: User ID
            document_data: Binary document data
            document_type: Type of document (id_card, selfie, etc.)
            
        Returns:
            dict: Storage result
        """
        file_name = f"{document_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.jpg"
        
        return SupabaseStorage.upload_file(
            bucket_name='ekyc-documents',
            file_data=document_data,
            file_name=file_name,
            user_id=user_id,
            content_type='image/jpeg'
        )
    
    @staticmethod
    def cleanup_old_files(user_id: str, bucket_name: str, days_old: int = 30):
        """
        Clean up old files for a user (for privacy compliance)
        
        Args:
            user_id: User ID
            bucket_name: Storage bucket name
            days_old: Number of days after which files should be deleted
            
        Returns:
            dict: Cleanup result
        """
        try:
            files = SupabaseStorage.list_user_files(bucket_name, user_id)
            deleted_count = 0
            
            cutoff_date = datetime.utcnow().timestamp() - (days_old * 24 * 60 * 60)
            
            for file_info in files:
                # Check file creation date
                if file_info.get('created_at'):
                    file_date = datetime.fromisoformat(file_info['created_at'].replace('Z', '+00:00')).timestamp()
                    
                    if file_date < cutoff_date:
                        file_path = f"{user_id}/{file_info['name']}"
                        result = SupabaseStorage.delete_file(bucket_name, file_path)
                        
                        if result.get('success'):
                            deleted_count += 1
            
            logger.info(f"Cleaned up {deleted_count} old files for user {user_id}")
            
            return {
                'success': True,
                'deleted_count': deleted_count
            }
            
        except Exception as e:
            logger.error(f"Error during file cleanup: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }