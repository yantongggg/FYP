# backend/routes/behavior.py
# Unified behavioral monitoring system with all functionality merged

import asyncio
import json
import logging
import time
import hashlib
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from flask import Blueprint, request, jsonify
from supabase import create_client, Client
import scipy.stats as stats
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

behavioral_bp = Blueprint('behavioral', __name__)

# =====================================
# DATA MODELS
# =====================================

@dataclass
class KeystrokeEvent:
    key: str
    code: str
    timestamp: int
    type: str  # 'keydown' or 'keyup'
    ctrl_key: bool = False
    shift_key: bool = False
    alt_key: bool = False

@dataclass
class MouseEvent:
    x: int
    y: int
    timestamp: int
    type: str  # 'mousemove', 'click', 'scroll'
    button: Optional[int] = None
    velocity: Optional[float] = None
    deltaY: Optional[float] = None

@dataclass
class VerificationResult:
    success: bool
    similarity_score: float
    keystroke_similarity: float
    mouse_similarity: float
    anomaly_detected: bool
    anomaly_score: float
    action: Optional[str] = None
    error: Optional[str] = None

# =====================================
# UNIFIED BEHAVIORAL ANALYZER
# =====================================

class UnifiedBehavioralAnalyzer:
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        self.scaler = StandardScaler()
        
        # Configurable thresholds
        self.thresholds = {
            'similarity_threshold': 0.4,      # Minimum similarity to pass
            'critical_threshold': 0.3,        # Below this = auto-lock
            'anomaly_threshold': 0.6,         # Above this = anomaly
            'typing_speed_variance': 0.5,
            'mouse_velocity_variance': 3.0
        }

    def extract_keystroke_features(self, events: List[Dict], typed_text: str = "") -> Dict:
        """Extract comprehensive keystroke features"""
        if not events:
            return {}
        
        # Convert to KeystrokeEvent objects if needed
        if isinstance(events[0], dict):
            events = [KeystrokeEvent(**e) for e in events]
        
        features = {}
        
        # Separate event types
        keydown_events = [e for e in events if e.type == 'keydown']
        keyup_events = [e for e in events if e.type == 'keyup']
        
        if not keydown_events:
            return {}
        
        # Basic metrics
        features['total_keystrokes'] = len(events)
        features['total_characters'] = len(typed_text)
        
        # Time-based features
        start_time = events[0].timestamp
        end_time = events[-1].timestamp
        duration = (end_time - start_time) / 1000.0  # Convert to seconds
        
        features['typing_duration'] = duration
        if duration > 0:
            features['typing_speed'] = features['total_characters'] / duration
            features['keys_per_second'] = len(keydown_events) / duration
        
        # Dwell times (key hold duration)
        dwell_times = []
        for keydown in keydown_events:
            matching_keyup = next(
                (up for up in keyup_events 
                 if up.key == keydown.key and up.timestamp > keydown.timestamp),
                None
            )
            if matching_keyup:
                dwell_time = matching_keyup.timestamp - keydown.timestamp
                if dwell_time < 1000:  # Reasonable limit
                    dwell_times.append(dwell_time)
        
        if dwell_times:
            features['avg_dwell_time'] = np.mean(dwell_times)
            features['std_dwell_time'] = np.std(dwell_times)
            features['dwell_time_variance'] = np.var(dwell_times)
        
        # Flight times (time between keystrokes)
        flight_times = []
        for i in range(1, len(keydown_events)):
            flight_time = keydown_events[i].timestamp - keydown_events[i-1].timestamp
            if flight_time < 2000:  # Reasonable limit
                flight_times.append(flight_time)
        
        if flight_times:
            features['avg_flight_time'] = np.mean(flight_times)
            features['std_flight_time'] = np.std(flight_times)
            features['flight_time_variance'] = np.var(flight_times)
        
        # Rhythm consistency
        if len(flight_times) > 5:
            features['rhythm_consistency'] = 1.0 / (1.0 + np.std(flight_times) / (np.mean(flight_times) + 1))
        
        return features

    def extract_mouse_features(self, events: List[Dict]) -> Dict:
        """Extract comprehensive mouse features"""
        if not events:
            return {}
        
        # Convert to MouseEvent objects if needed
        if isinstance(events[0], dict):
            events = [MouseEvent(**e) for e in events]
        
        features = {}
        
        # Separate event types
        move_events = [e for e in events if e.type == 'mousemove']
        click_events = [e for e in events if e.type == 'click']
        
        features['total_mouse_events'] = len(events)
        features['move_events'] = len(move_events)
        features['click_events'] = len(click_events)
        
        if move_events:
            # Movement analysis
            distances = []
            velocities = []
            
            for i in range(1, len(move_events)):
                curr = move_events[i]
                prev = move_events[i-1]
                
                # Distance
                distance = np.sqrt((curr.x - prev.x)**2 + (curr.y - prev.y)**2)
                distances.append(distance)
                
                # Velocity
                time_diff = (curr.timestamp - prev.timestamp) / 1000.0
                if time_diff > 0:
                    velocity = distance / time_diff
                    velocities.append(velocity)
            
            if distances:
                features['avg_distance'] = np.mean(distances)
                features['total_distance'] = sum(distances)
            
            if velocities:
                features['avg_velocity'] = np.mean(velocities)
                features['std_velocity'] = np.std(velocities)
                features['max_velocity'] = max(velocities)
        
        # Click patterns
        if len(click_events) > 1:
            click_intervals = []
            for i in range(1, len(click_events)):
                interval = click_events[i].timestamp - click_events[i-1].timestamp
                click_intervals.append(interval)
            
            if click_intervals:
                features['avg_click_interval'] = np.mean(click_intervals)
        
        return features

    def calculate_similarity(self, current_features: Dict, stored_features: Dict) -> float:
        """Calculate similarity between feature sets"""
        if not current_features or not stored_features:
            return 0.5
        
        # Key features for comparison
        key_features = [
            'typing_speed', 'avg_dwell_time', 'avg_flight_time',
            'avg_velocity', 'avg_distance', 'avg_click_interval'
        ]
        
        similarities = []
        for feature in key_features:
            if feature in current_features and feature in stored_features:
                curr_val = float(current_features[feature])
                stored_val = float(stored_features[feature])
                
                if stored_val == 0 and curr_val == 0:
                    similarity = 1.0
                elif stored_val == 0:
                    similarity = 0.5
                else:
                    # Calculate normalized difference
                    diff = abs(curr_val - stored_val) / stored_val
                    similarity = max(0, 1 - diff)
                
                similarities.append(similarity)
        
        return np.mean(similarities) if similarities else 0.5

    async def verify_behavior(self, user_id: str, behavioral_data: Dict, 
                            typed_text: str, session_id: str) -> VerificationResult:
        """Verify behavioral patterns against stored profile"""
        try:
            # Extract current features
            current_keystroke = self.extract_keystroke_features(
                behavioral_data.get('keystrokes', []), 
                typed_text
            )
            current_mouse = self.extract_mouse_features(
                behavioral_data.get('mouseMovements', [])
            )
            
            # Get stored patterns
            pattern_result = self.supabase.table('behavioral_patterns') \
                .select('*') \
                .eq('user_id', user_id) \
                .eq('is_active', True) \
                .single() \
                .execute()
            
            if not pattern_result.data:
                return VerificationResult(
                    success=False,
                    similarity_score=0,
                    keystroke_similarity=0,
                    mouse_similarity=0,
                    anomaly_detected=True,
                    anomaly_score=1.0,
                    error="No behavioral profile found"
                )
            
            stored_pattern = pattern_result.data['pattern_data']
            
            # Calculate similarities
            keystroke_sim = self.calculate_similarity(
                current_keystroke, 
                stored_pattern.get('keystroke_features', {})
            )
            mouse_sim = self.calculate_similarity(
                current_mouse, 
                stored_pattern.get('mouse_features', {})
            )
            
            # Overall similarity (weighted)
            overall_sim = (keystroke_sim * 0.6 + mouse_sim * 0.4)
            
            # Anomaly detection
            anomaly_score = 1 - overall_sim
            anomaly_detected = anomaly_score > self.thresholds['anomaly_threshold']
            
            # Determine action
            action = None
            if overall_sim < self.thresholds['critical_threshold']:
                action = 'auto_lock'
                await self._suspend_user(user_id, f"Critical behavioral anomaly: {overall_sim:.2f}")
            elif anomaly_detected:
                action = 'monitor'
            
            # Store session
            await self._store_session(
                user_id, session_id, current_keystroke, current_mouse,
                overall_sim, anomaly_detected, anomaly_score
            )
            
            # Log anomaly if detected
            if anomaly_detected:
                await self._log_anomaly(
                    user_id, session_id, anomaly_score, action,
                    {'similarity': overall_sim, 'type': 'behavioral_mismatch'}
                )
            
            # Update trust score
            if anomaly_detected:
                await self._update_trust_score(user_id, -10)
            else:
                await self._update_trust_score(user_id, 1)
            
            return VerificationResult(
                success=not (action == 'auto_lock'),
                similarity_score=overall_sim,
                keystroke_similarity=keystroke_sim,
                mouse_similarity=mouse_sim,
                anomaly_detected=anomaly_detected,
                anomaly_score=anomaly_score,
                action=action
            )
            
        except Exception as e:
            logger.error(f"Verification error: {e}")
            return VerificationResult(
                success=False,
                similarity_score=0,
                keystroke_similarity=0,
                mouse_similarity=0,
                anomaly_detected=True,
                anomaly_score=1.0,
                error=str(e)
            )

    async def _store_session(self, user_id: str, session_id: str,
                           keystroke_features: Dict, mouse_features: Dict,
                           similarity: float, anomaly_detected: bool,
                           anomaly_score: float):
        """Store behavioral session"""
        try:
            session_data = {
                'user_id': user_id,
                'session_id': session_id,
                'keystroke_features': keystroke_features,
                'mouse_features': mouse_features,
                'similarity_scores': {
                    'overall_similarity': similarity,
                    'keystroke_similarity': keystroke_features.get('similarity', 0),
                    'mouse_similarity': mouse_features.get('similarity', 0)
                },
                'anomaly_score': anomaly_score,
                'is_successful': not anomaly_detected,
                'duration_seconds': keystroke_features.get('typing_duration', 0),
                'created_at': datetime.utcnow().isoformat()
            }
            
            self.supabase.table('behavioral_sessions').insert(session_data).execute()
            
        except Exception as e:
            logger.error(f"Failed to store session: {e}")

    async def _log_anomaly(self, user_id: str, session_id: str, 
                         anomaly_score: float, action: str, details: Dict):
        """Log anomaly to audit table"""
        try:
            # Determine severity
            if anomaly_score > 0.9:
                severity = 'critical'
            elif anomaly_score > 0.7:
                severity = 'high'
            elif anomaly_score > 0.5:
                severity = 'medium'
            else:
                severity = 'low'
            
            anomaly_data = {
                'user_id': user_id,
                'session_id': session_id,
                'anomaly_type': details.get('type', 'behavioral_anomaly'),
                'anomaly_score': anomaly_score,
                'severity': severity,
                'action_taken': action or 'logged',
                'details': details,
                'created_at': datetime.utcnow().isoformat()
            }
            
            self.supabase.table('anomaly_audits').insert(anomaly_data).execute()
            
        except Exception as e:
            logger.error(f"Failed to log anomaly: {e}")

    async def _update_trust_score(self, user_id: str, delta: int):
        """Update user trust score"""
        try:
            # Get current score
            user_result = self.supabase.table('users') \
                .select('trust_score') \
                .eq('id', user_id) \
                .single() \
                .execute()
            
            if user_result.data:
                current_score = user_result.data['trust_score']
                new_score = max(0, min(100, current_score + delta))
                
                self.supabase.table('users') \
                    .update({'trust_score': new_score}) \
                    .eq('id', user_id) \
                    .execute()
                    
        except Exception as e:
            logger.error(f"Failed to update trust score: {e}")

    async def _suspend_user(self, user_id: str, reason: str):
        """Suspend user account"""
        try:
            self.supabase.table('users').update({
                'status': 'suspended',
                'suspension_reason': reason,
                'suspended_at': datetime.utcnow().isoformat()
            }).eq('id', user_id).execute()
            
            logger.warning(f"User {user_id} suspended: {reason}")
            
        except Exception as e:
            logger.error(f"Failed to suspend user: {e}")

# =====================================
# INITIALIZATION
# =====================================

analyzer = None

def init_behavioral_system(supabase_client: Client):
    """Initialize the behavioral analysis system"""
    global analyzer
    analyzer = UnifiedBehavioralAnalyzer(supabase_client)
    logger.info("Unified behavioral analysis system initialized")

# =====================================
# API ENDPOINTS
# =====================================

@behavioral_bp.route('/behavioral-verify', methods=['POST'])
async def behavioral_verify():
    """Verify user behavioral patterns"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        behavioral_data = data.get('behavioralData', {})
        typed_text = data.get('typedText', '')
        session_id = data.get('session_id', f"verify_{user_id}_{int(time.time())}")
        
        # Validate required fields
        if not all([user_id, behavioral_data, typed_text]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        # Verify exact text match
        REFERENCE_SENTENCE = "The quick brown fox jumps over the lazy dog."
        if typed_text != REFERENCE_SENTENCE:
            return jsonify({
                'success': False,
                'error': 'Text mismatch. Please type the exact sentence.',
                'expected': REFERENCE_SENTENCE,
                'received': typed_text
            }), 400
        
        # Perform verification
        result = await analyzer.verify_behavior(
            user_id, behavioral_data, typed_text, session_id
        )
        
        # Return response
        return jsonify(asdict(result))
        
    except Exception as e:
        logger.error(f"Behavioral verification error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@behavioral_bp.route('/behavioral-monitor', methods=['POST'])
async def behavioral_monitor():
    """Continuous behavioral monitoring endpoint"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        behavioral_data = data.get('behavioralData', {})
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        # Process in background (non-blocking)
        asyncio.create_task(
            analyzer.verify_behavior(
                user_id, 
                behavioral_data, 
                "",  # No typed text for continuous monitoring
                f"monitor_{user_id}_{int(time.time())}"
            )
        )
        
        return jsonify({
            'success': True,
            'message': 'Behavioral data processed'
        })
        
    except Exception as e:
        logger.error(f"Monitor error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@behavioral_bp.route('/behavioral-analytics/<user_id>', methods=['GET'])
def get_behavioral_analytics(user_id: str):
    """Get user's behavioral analytics"""
    try:
        # Get recent sessions
        sessions_result = analyzer.supabase.table('behavioral_sessions') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('created_at', desc=True) \
            .limit(50) \
            .execute()
        
        # Get anomalies
        anomalies_result = analyzer.supabase.table('anomaly_audits') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('created_at', desc=True) \
            .limit(20) \
            .execute()
        
        sessions = sessions_result.data or []
        anomalies = anomalies_result.data or []
        
        # Calculate analytics
        analytics = {
            'total_sessions': len(sessions),
            'successful_sessions': len([s for s in sessions if s.get('is_successful')]),
            'total_anomalies': len(anomalies),
            'recent_anomalies': len([
                a for a in anomalies 
                if datetime.fromisoformat(a['created_at'].replace('Z', '+00:00')) > 
                   datetime.utcnow() - timedelta(days=7)
            ]),
            'avg_similarity_score': np.mean([
                s.get('similarity_scores', {}).get('overall_similarity', 0) 
                for s in sessions if s.get('similarity_scores')
            ]) if sessions else 0,
            'sessions': sessions[:10],
            'anomalies': anomalies[:5]
        }
        
        return jsonify({
            'success': True,
            'analytics': analytics
        })
        
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500