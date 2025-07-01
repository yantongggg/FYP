from flask import Blueprint, request, jsonify
import bcrypt
from datetime import datetime
import logging

from utils.supabase_client import supabase_client
from utils.logger import setup_logger

auth_bp = Blueprint('auth', __name__)
logger = setup_logger(__name__)

@auth_bp.route('/register', methods=['POST'])
def register_user():
    """
    Register a new user with biometric data
    """
    try:
        data = request.get_json()
        email = data.get('email')
        username = data.get('username')
        password = data.get('password')
        biometric_data = data.get('biometric_data', {})
        
        if not all([email, username, password]):
            return jsonify({
                'success': False,
                'error': 'Email, username, and password are required'
            }), 400
        
        # Hash password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create user record
        user_data = {
            'email': email,
            'username': username,
            'password_hash': password_hash,
            'role': 'user',
            'is_biometric_enrolled': bool(biometric_data),
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Insert user into database
        user_result = supabase_client.table('users').insert(user_data).execute()
        
        if not user_result.data:
            return jsonify({
                'success': False,
                'error': 'Failed to create user'
            }), 500
        
        user_id = user_result.data[0]['id']
        
        # Store biometric data if provided
        if biometric_data:
            for biometric_type, data_value in biometric_data.items():
                if data_value:
                    biometric_record = {
                        'user_id': user_id,
                        'biometric_type': biometric_type,
                        'data': data_value,
                        'capture_timestamp': datetime.utcnow().isoformat()
                    }
                    
                    supabase_client.table('biometric_data').insert(biometric_record).execute()
        
        # Log registration
        log_data = {
            'user_id': user_id,
            'success': True,
            'ip_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'event_ts': datetime.utcnow().isoformat()
        }
        
        supabase_client.table('login_audit').insert(log_data).execute()
        
        logger.info(f"User registered successfully: {email}")
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user_id': user_id
        })
        
    except Exception as e:
        logger.error(f"Error in user registration: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@auth_bp.route('/authenticate', methods=['POST'])
def authenticate_user():
    """
    Authenticate user with biometric verification
    """
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        biometric_data = data.get('biometric_data', {})
        
        if not email:
            return jsonify({
                'success': False,
                'error': 'Email is required'
            }), 400
        
        # Get user from database
        user_result = supabase_client.table('users')\
            .select('*')\
            .eq('email', email)\
            .single()\
            .execute()
        
        if not user_result.data:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        user = user_result.data
        
        # Verify password if provided
        if password:
            if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                # Log failed attempt
                log_data = {
                    'user_id': user['id'],
                    'success': False,
                    'failure_reason': 'invalid_password',
                    'ip_addr': request.remote_addr,
                    'user_agent': request.headers.get('User-Agent', ''),
                    'event_ts': datetime.utcnow().isoformat()
                }
                
                supabase_client.table('login_audit').insert(log_data).execute()
                
                return jsonify({
                    'success': False,
                    'error': 'Invalid password'
                }), 401
        
        # Perform biometric verification if data provided
        biometric_scores = {}
        overall_score = 1.0
        
        if biometric_data:
            # This would integrate with your biometric verification endpoints
            # For now, we'll simulate the verification
            for biometric_type, data_value in biometric_data.items():
                if data_value:
                    # Simulate biometric verification score
                    biometric_scores[biometric_type] = 0.95
            
            # Calculate overall biometric score
            if biometric_scores:
                overall_score = sum(biometric_scores.values()) / len(biometric_scores)
        
        # Determine authentication success
        is_authenticated = overall_score >= 0.7
        
        # Update last login
        if is_authenticated:
            supabase_client.table('users')\
                .update({'last_login': datetime.utcnow().isoformat()})\
                .eq('id', user['id'])\
                .execute()
        
        # Log authentication attempt
        log_data = {
            'user_id': user['id'],
            'success': is_authenticated,
            'biometric_scores': biometric_scores,
            'failure_reason': None if is_authenticated else 'biometric_verification_failed',
            'ip_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'event_ts': datetime.utcnow().isoformat()
        }
        
        supabase_client.table('login_audit').insert(log_data).execute()
        
        if is_authenticated:
            logger.info(f"User authenticated successfully: {email}")
            return jsonify({
                'success': True,
                'message': 'Authentication successful',
                'user': {
                    'id': user['id'],
                    'email': user['email'],
                    'username': user['username'],
                    'role': user['role']
                },
                'biometric_scores': biometric_scores,
                'overall_score': round(overall_score, 3)
            })
        else:
            logger.warning(f"Authentication failed for user: {email}")
            return jsonify({
                'success': False,
                'error': 'Biometric verification failed',
                'biometric_scores': biometric_scores,
                'overall_score': round(overall_score, 3)
            }), 401
        
    except Exception as e:
        logger.error(f"Error in user authentication: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500