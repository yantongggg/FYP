import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import logging

logger = logging.getLogger(__name__)

class BiometricEncryption:
    """Utility class for encrypting/decrypting biometric data"""
    
    @staticmethod
    def generate_key_from_password(password: str, salt: bytes = None) -> bytes:
        """
        Generate encryption key from password using PBKDF2
        
        Args:
            password: Password string
            salt: Salt bytes (generated if not provided)
            
        Returns:
            tuple: (key, salt)
        """
        if salt is None:
            salt = os.urandom(16)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key, salt
    
    @staticmethod
    def encrypt_biometric_data(data: str, encryption_key: str = None) -> dict:
        """
        Encrypt biometric data using Fernet symmetric encryption
        
        Args:
            data: String data to encrypt
            encryption_key: Optional encryption key (uses env var if not provided)
            
        Returns:
            dict: Encrypted data with metadata
        """
        try:
            if encryption_key is None:
                encryption_key = os.getenv('BIOMETRIC_ENCRYPTION_KEY')
                
            if not encryption_key:
                # Generate a key if none provided
                key = Fernet.generate_key()
                logger.warning("No encryption key provided, generated temporary key")
            else:
                # Use provided key or derive from password
                if len(encryption_key) == 44:  # Fernet key length
                    key = encryption_key.encode()
                else:
                    key, salt = BiometricEncryption.generate_key_from_password(encryption_key)
            
            fernet = Fernet(key)
            encrypted_data = fernet.encrypt(data.encode())
            
            return {
                'success': True,
                'encrypted_data': base64.b64encode(encrypted_data).decode(),
                'encryption_method': 'fernet',
                'key_derivation': 'pbkdf2' if len(encryption_key) != 44 else 'direct'
            }
            
        except Exception as e:
            logger.error(f"Error encrypting biometric data: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def decrypt_biometric_data(encrypted_data: str, encryption_key: str = None) -> dict:
        """
        Decrypt biometric data
        
        Args:
            encrypted_data: Base64 encoded encrypted data
            encryption_key: Encryption key
            
        Returns:
            dict: Decrypted data or error
        """
        try:
            if encryption_key is None:
                encryption_key = os.getenv('BIOMETRIC_ENCRYPTION_KEY')
                
            if not encryption_key:
                return {
                    'success': False,
                    'error': 'No encryption key available'
                }
            
            # Prepare key
            if len(encryption_key) == 44:  # Fernet key length
                key = encryption_key.encode()
            else:
                key, _ = BiometricEncryption.generate_key_from_password(encryption_key)
            
            fernet = Fernet(key)
            
            # Decode and decrypt
            encrypted_bytes = base64.b64decode(encrypted_data.encode())
            decrypted_data = fernet.decrypt(encrypted_bytes)
            
            return {
                'success': True,
                'decrypted_data': decrypted_data.decode()
            }
            
        except Exception as e:
            logger.error(f"Error decrypting biometric data: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def hash_biometric_template(template_data: str) -> str:
        """
        Create a hash of biometric template for comparison
        
        Args:
            template_data: Biometric template string
            
        Returns:
            str: SHA256 hash of the template
        """
        try:
            import hashlib
            
            # Create SHA256 hash
            hash_object = hashlib.sha256(template_data.encode())
            return hash_object.hexdigest()
            
        except Exception as e:
            logger.error(f"Error hashing biometric template: {str(e)}")
            return ""

class SecureStorage:
    """Utility for secure storage operations"""
    
    @staticmethod
    def store_encrypted_biometric(user_id: str, biometric_type: str, data: str, 
                                 quality_score: float = None) -> dict:
        """
        Store encrypted biometric data in database
        
        Args:
            user_id: User ID
            biometric_type: Type of biometric data
            data: Raw biometric data
            quality_score: Quality assessment score
            
        Returns:
            dict: Storage result
        """
        try:
            from utils.supabase_client import supabase_client
            
            # Encrypt the data
            encryption_result = BiometricEncryption.encrypt_biometric_data(data)
            
            if not encryption_result.get('success'):
                return encryption_result
            
            # Create hash for quick comparison
            data_hash = BiometricEncryption.hash_biometric_template(data)
            
            # Prepare database record
            biometric_record = {
                'user_id': user_id,
                'biometric_type': biometric_type,
                'data': {
                    'encrypted': True,
                    'hash': data_hash,
                    'encryption_method': encryption_result['encryption_method']
                },
                'encrypted_biometric_blob': encryption_result['encrypted_data'],
                'quality_score': quality_score,
                'capture_timestamp': datetime.utcnow().isoformat()
            }
            
            # Store in database
            result = supabase_client.table('biometric_data').insert(biometric_record).execute()
            
            if result.data:
                logger.info(f"Encrypted biometric data stored for user {user_id}")
                return {
                    'success': True,
                    'record_id': result.data[0]['id']
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to store in database'
                }
                
        except Exception as e:
            logger.error(f"Error storing encrypted biometric data: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def retrieve_encrypted_biometric(user_id: str, biometric_type: str) -> dict:
        """
        Retrieve and decrypt biometric data
        
        Args:
            user_id: User ID
            biometric_type: Type of biometric data
            
        Returns:
            dict: Decrypted data or error
        """
        try:
            from utils.supabase_client import supabase_client
            
            # Retrieve from database
            result = supabase_client.table('biometric_data')\
                .select('*')\
                .eq('user_id', user_id)\
                .eq('biometric_type', biometric_type)\
                .order('capture_timestamp', desc=True)\
                .limit(1)\
                .execute()
            
            if not result.data:
                return {
                    'success': False,
                    'error': 'No biometric data found'
                }
            
            record = result.data[0]
            
            # Check if data is encrypted
            if record.get('encrypted_biometric_blob'):
                # Decrypt the data
                decryption_result = BiometricEncryption.decrypt_biometric_data(
                    record['encrypted_biometric_blob']
                )
                
                if decryption_result.get('success'):
                    return {
                        'success': True,
                        'data': decryption_result['decrypted_data'],
                        'quality_score': record.get('quality_score'),
                        'capture_timestamp': record.get('capture_timestamp')
                    }
                else:
                    return decryption_result
            else:
                # Data is not encrypted (legacy or plain storage)
                return {
                    'success': True,
                    'data': record.get('data'),
                    'quality_score': record.get('quality_score'),
                    'capture_timestamp': record.get('capture_timestamp')
                }
                
        except Exception as e:
            logger.error(f"Error retrieving encrypted biometric data: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }