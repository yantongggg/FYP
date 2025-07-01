from flask import Blueprint, request, jsonify
import numpy as np
from datetime import datetime
import logging

from ml_models.behavior_auth import BehaviorAuthModel
from utils.supabase_client import supabase_client
from utils.logger import setup_logger

behavior_bp = Blueprint('behavior', __name__)
logger = setup_logger(__name__)

# Initialize behavior authentication model
behavior_model = BehaviorAuthModel()

@behavior_bp.route('/behavior-check', methods=['POST'])
def behavior_check():
    """
    Analyze behavioral biometrics (keystroke, mouse, scroll patterns)
    """
    try:
        data = request.get_json()
        keystroke_data = data.get('keystroke_data', [])
        mouse_data = data.get('mouse_data', [])
        scroll_data = data.get('scroll_data', [])
        user_id = data.get('user_id')
        
        if not any([keystroke_data, mouse_data, scroll_data]):
            return jsonify({
                'success': False,
                'error': 'At least one type of behavioral data is required'
            }), 400
        
        # Extract features from behavioral data
        features = behavior_model.extract_features({
            'keystroke': keystroke_data,
            'mouse': mouse_data,
            'scroll': scroll_data
        })
        
        # Get stored behavioral profile for comparison
        stored_profile = None
        if user_id:
            profile_data = supabase_client.table('biometric_data')\
                .select('data')\
                .eq('user_id', user_id)\
                .eq('biometric_type', 'keystroke')\
                .order('capture_timestamp', desc=True)\
                .limit(1)\
                .execute()
            
            if profile_data.data:
                stored_profile = profile_data.data[0]['data'].get('features')
        
        # Calculate behavioral scores
        if stored_profile:
            # Compare against stored profile
            keystroke_score = behavior_model.compare_keystroke_patterns(
                features.get('keystroke', {}), 
                stored_profile.get('keystroke', {})
            )
            
            mouse_score = behavior_model.compare_mouse_patterns(
                features.get('mouse', {}), 
                stored_profile.get('mouse', {})
            )
            
            scroll_score = behavior_model.compare_scroll_patterns(
                features.get('scroll', {}), 
                stored_profile.get('scroll', {})
            )
            
            # Calculate overall behavioral match score
            scores = [s for s in [keystroke_score, mouse_score, scroll_score] if s is not None]
            overall_score = np.mean(scores) if scores else 0.0
            
        else:
            # No stored profile - this might be enrollment
            keystroke_score = 0.5 if keystroke_data else None
            mouse_score = 0.5 if mouse_data else None
            scroll_score = 0.5 if scroll_data else None
            overall_score = 0.5
        
        # Detect anomalies
        anomaly_detection = behavior_model.detect_anomalies(features)
        
        # Calculate risk assessment
        risk_assessment = behavior_model.assess_risk({
            'behavioral_score': overall_score,
            'anomaly_score': anomaly_detection.get('score', 0),
            'data_quality': features.get('quality_metrics', {})
        })
        
        # Determine if behavior matches
        threshold = 0.6
        is_match = overall_score >= threshold and not anomaly_detection.get('is_anomalous', False)
        
        # Store behavioral session data
        if user_id:
            session_data = {
                'user_id': user_id,
                'keystroke_events': keystroke_data,
                'mouse_events': mouse_data,
                'scroll_events': scroll_data,
                'anomaly_score': anomaly_detection.get('score', 0),
                'session_start': datetime.utcnow().isoformat(),
                'is_active': True
            }
            
            supabase_client.table('behavioral_sessions').insert(session_data).execute()
        
        # Log anomalies if detected
        if anomaly_detection.get('is_anomalous') and user_id:
            anomaly_data = {
                'user_id': user_id,
                'anomaly_type': 'behavioral_deviation',
                'score': anomaly_detection.get('score', 0),
                'action': 'monitor',
                'details': {
                    'behavioral_scores': {
                        'keystroke': keystroke_score,
                        'mouse': mouse_score,
                        'scroll': scroll_score,
                        'overall': overall_score
                    },
                    'anomaly_details': anomaly_detection,
                    'risk_assessment': risk_assessment
                }
            }
            
            supabase_client.table('anomaly_audit').insert(anomaly_data).execute()
            logger.warning(f"Behavioral anomaly detected - User: {user_id}, Score: {anomaly_detection.get('score', 0):.3f}")
        
        logger.info(f"Behavior check - User: {user_id}, Score: {overall_score:.3f}, Match: {is_match}")
        
        return jsonify({
            'success': True,
            'behavioral_score': round(overall_score, 3),
            'is_match': is_match,
            'threshold': threshold,
            'component_scores': {
                'keystroke': round(keystroke_score, 3) if keystroke_score is not None else None,
                'mouse': round(mouse_score, 3) if mouse_score is not None else None,
                'scroll': round(scroll_score, 3) if scroll_score is not None else None
            },
            'anomaly_detection': {
                'is_anomalous': anomaly_detection.get('is_anomalous', False),
                'anomaly_score': round(anomaly_detection.get('score', 0), 3),
                'anomaly_types': anomaly_detection.get('types', [])
            },
            'risk_assessment': risk_assessment,
            'features_extracted': {
                'keystroke_features': len(features.get('keystroke', {})),
                'mouse_features': len(features.get('mouse', {})),
                'scroll_features': len(features.get('scroll', {}))
            }
        })
        
    except Exception as e:
        logger.error(f"Error in behavior check: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'behavioral_score': 0.0,
            'is_match': False
        }), 500

@behavior_bp.route('/behavior-enroll', methods=['POST'])
def behavior_enroll():
    """
    Enroll behavioral biometric profile for a user
    """
    try:
        data = request.get_json()
        keystroke_data = data.get('keystroke_data', [])
        mouse_data = data.get('mouse_data', [])
        scroll_data = data.get('scroll_data', [])
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User ID is required'
            }), 400
        
        if not any([keystroke_data, mouse_data, scroll_data]):
            return jsonify({
                'success': False,
                'error': 'At least one type of behavioral data is required'
            }), 400
        
        # Extract features
        features = behavior_model.extract_features({
            'keystroke': keystroke_data,
            'mouse': mouse_data,
            'scroll': scroll_data
        })
        
        # Calculate quality metrics
        quality_metrics = behavior_model.calculate_quality_metrics({
            'keystroke': keystroke_data,
            'mouse': mouse_data,
            'scroll': scroll_data
        })
        
        overall_quality = np.mean(list(quality_metrics.values()))
        
        if overall_quality < 0.5:
            return jsonify({
                'success': False,
                'error': 'Behavioral data quality is too low for enrollment',
                'quality_score': overall_quality,
                'quality_metrics': quality_metrics
            })
        
        # Store behavioral profile
        profile_data = {
            'user_id': user_id,
            'biometric_type': 'keystroke',  # Primary type for behavioral data
            'data': {
                'features': features,
                'quality_metrics': quality_metrics,
                'enrollment_data': {
                    'keystroke_events': len(keystroke_data),
                    'mouse_events': len(mouse_data),
                    'scroll_events': len(scroll_data)
                },
                'enrollment_timestamp': datetime.utcnow().isoformat()
            },
            'quality_score': overall_quality,
            'capture_timestamp': datetime.utcnow().isoformat()
        }
        
        result = supabase_client.table('biometric_data').insert(profile_data).execute()
        
        # Also store mouse and scroll data separately if available
        if mouse_data:
            mouse_profile = {
                'user_id': user_id,
                'biometric_type': 'mouse',
                'data': {
                    'features': features.get('mouse', {}),
                    'raw_events': mouse_data,
                    'enrollment_timestamp': datetime.utcnow().isoformat()
                },
                'quality_score': quality_metrics.get('mouse', 0),
                'capture_timestamp': datetime.utcnow().isoformat()
            }
            supabase_client.table('biometric_data').insert(mouse_profile).execute()
        
        if scroll_data:
            scroll_profile = {
                'user_id': user_id,
                'biometric_type': 'scroll',
                'data': {
                    'features': features.get('scroll', {}),
                    'raw_events': scroll_data,
                    'enrollment_timestamp': datetime.utcnow().isoformat()
                },
                'quality_score': quality_metrics.get('scroll', 0),
                'capture_timestamp': datetime.utcnow().isoformat()
            }
            supabase_client.table('biometric_data').insert(scroll_profile).execute()
        
        logger.info(f"Behavioral profile enrolled - User: {user_id}, Quality: {overall_quality:.3f}")
        
        return jsonify({
            'success': True,
            'message': 'Behavioral profile enrolled successfully',
            'quality_score': round(overall_quality, 3),
            'quality_metrics': {k: round(v, 3) for k, v in quality_metrics.items()},
            'features_extracted': {
                'keystroke_features': len(features.get('keystroke', {})),
                'mouse_features': len(features.get('mouse', {})),
                'scroll_features': len(features.get('scroll', {}))
            },
            'enrollment_id': result.data[0]['id'] if result.data else None
        })
        
    except Exception as e:
        logger.error(f"Error in behavior enrollment: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@behavior_bp.route('/behavior-analysis', methods=['POST'])
def behavior_analysis():
    """
    Perform detailed behavioral analysis for monitoring
    """
    try:
        data = request.get_json()
        behavioral_data = data.get('behavioral_data', {})
        user_id = data.get('user_id')
        analysis_type = data.get('analysis_type', 'comprehensive')
        
        if not behavioral_data:
            return jsonify({
                'success': False,
                'error': 'Behavioral data is required'
            }), 400
        
        # Perform analysis based on type
        if analysis_type == 'real_time':
            analysis_result = behavior_model.real_time_analysis(behavioral_data)
        elif analysis_type == 'session':
            analysis_result = behavior_model.session_analysis(behavioral_data)
        else:
            analysis_result = behavior_model.comprehensive_analysis(behavioral_data)
        
        # Generate insights and recommendations
        insights = behavior_model.generate_insights(analysis_result)
        recommendations = behavior_model.get_security_recommendations(analysis_result)
        
        return jsonify({
            'success': True,
            'analysis_type': analysis_type,
            'analysis_result': analysis_result,
            'insights': insights,
            'recommendations': recommendations,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in behavior analysis: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500