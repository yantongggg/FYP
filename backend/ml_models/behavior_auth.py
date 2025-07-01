import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class BehaviorAuthModel:
    """
    Behavioral biometrics authentication using keystroke dynamics, mouse patterns, and scroll behavior
    """
    
    def __init__(self):
        self.keystroke_model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.mouse_model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.anomaly_detector = IsolationForest(contamination=0.1, random_state=42)
        self.scaler = StandardScaler()
        self.is_trained = False
    
    def extract_features(self, behavioral_data):
        """
        Extract features from behavioral data
        """
        try:
            features = {}
            
            # Extract keystroke features
            if 'keystroke' in behavioral_data and behavioral_data['keystroke']:
                features['keystroke'] = self.extract_keystroke_features(behavioral_data['keystroke'])
            
            # Extract mouse features
            if 'mouse' in behavioral_data and behavioral_data['mouse']:
                features['mouse'] = self.extract_mouse_features(behavioral_data['mouse'])
            
            # Extract scroll features
            if 'scroll' in behavioral_data and behavioral_data['scroll']:
                features['scroll'] = self.extract_scroll_features(behavioral_data['scroll'])
            
            # Calculate quality metrics
            features['quality_metrics'] = self.calculate_quality_metrics(behavioral_data)
            
            return features
            
        except Exception as e:
            logger.error(f"Error extracting features: {str(e)}")
            return {}
    
    def extract_keystroke_features(self, keystroke_events):
        """
        Extract keystroke dynamics features
        """
        try:
            if not keystroke_events:
                return {}
            
            # Separate keydown and keyup events
            keydown_events = [e for e in keystroke_events if e.get('type') == 'keydown']
            keyup_events = [e for e in keystroke_events if e.get('type') == 'keyup']
            
            # Calculate dwell times (key hold duration)
            dwell_times = []
            for down_event in keydown_events:
                matching_up = next((up for up in keyup_events 
                                  if up.get('key') == down_event.get('key') 
                                  and up.get('timestamp', 0) > down_event.get('timestamp', 0)), None)
                if matching_up:
                    dwell_time = matching_up['timestamp'] - down_event['timestamp']
                    dwell_times.append(dwell_time)
            
            # Calculate flight times (time between key releases and next key presses)
            flight_times = []
            sorted_events = sorted(keystroke_events, key=lambda x: x.get('timestamp', 0))
            for i in range(len(sorted_events) - 1):
                if (sorted_events[i].get('type') == 'keyup' and 
                    sorted_events[i + 1].get('type') == 'keydown'):
                    flight_time = sorted_events[i + 1]['timestamp'] - sorted_events[i]['timestamp']
                    flight_times.append(flight_time)
            
            # Calculate typing rhythm features
            inter_key_intervals = []
            keydown_times = [e['timestamp'] for e in keydown_events]
            for i in range(len(keydown_times) - 1):
                interval = keydown_times[i + 1] - keydown_times[i]
                inter_key_intervals.append(interval)
            
            # Extract statistical features
            features = {
                'avg_dwell_time': np.mean(dwell_times) if dwell_times else 0,
                'std_dwell_time': np.std(dwell_times) if dwell_times else 0,
                'avg_flight_time': np.mean(flight_times) if flight_times else 0,
                'std_flight_time': np.std(flight_times) if flight_times else 0,
                'avg_inter_key_interval': np.mean(inter_key_intervals) if inter_key_intervals else 0,
                'std_inter_key_interval': np.std(inter_key_intervals) if inter_key_intervals else 0,
                'typing_speed': len(keydown_events) / (max(keydown_times) - min(keydown_times)) * 1000 if len(keydown_times) > 1 else 0,
                'total_keys': len(keydown_events),
                'unique_keys': len(set(e.get('key', '') for e in keydown_events)),
                'dwell_time_variance': np.var(dwell_times) if dwell_times else 0,
                'flight_time_variance': np.var(flight_times) if flight_times else 0
            }
            
            # Add pressure features if available
            pressures = [e.get('pressure', 0.5) for e in keystroke_events if 'pressure' in e]
            if pressures:
                features.update({
                    'avg_pressure': np.mean(pressures),
                    'std_pressure': np.std(pressures),
                    'pressure_variance': np.var(pressures)
                })
            
            return features
            
        except Exception as e:
            logger.error(f"Error extracting keystroke features: {str(e)}")
            return {}
    
    def extract_mouse_features(self, mouse_events):
        """
        Extract mouse movement and click pattern features
        """
        try:
            if not mouse_events:
                return {}
            
            # Separate movement and click events
            move_events = [e for e in mouse_events if e.get('type') == 'move']
            click_events = [e for e in mouse_events if e.get('type') == 'click']
            
            if not move_events:
                return {}
            
            # Calculate movement features
            velocities = []
            accelerations = []
            directions = []
            distances = []
            
            for i in range(1, len(move_events)):
                prev_event = move_events[i - 1]
                curr_event = move_events[i]
                
                # Calculate distance
                dx = curr_event['x'] - prev_event['x']
                dy = curr_event['y'] - prev_event['y']
                distance = np.sqrt(dx**2 + dy**2)
                distances.append(distance)
                
                # Calculate velocity
                time_diff = curr_event['timestamp'] - prev_event['timestamp']
                velocity = distance / time_diff if time_diff > 0 else 0
                velocities.append(velocity)
                
                # Calculate direction
                direction = np.arctan2(dy, dx)
                directions.append(direction)
                
                # Calculate acceleration
                if i > 1 and velocities:
                    prev_velocity = velocities[-2] if len(velocities) > 1 else 0
                    acceleration = abs(velocity - prev_velocity) / time_diff if time_diff > 0 else 0
                    accelerations.append(acceleration)
            
            # Calculate curvature and smoothness
            curvatures = []
            for i in range(1, len(directions)):
                curvature = abs(directions[i] - directions[i - 1])
                curvatures.append(curvature)
            
            # Extract statistical features
            features = {
                'avg_velocity': np.mean(velocities) if velocities else 0,
                'std_velocity': np.std(velocities) if velocities else 0,
                'avg_acceleration': np.mean(accelerations) if accelerations else 0,
                'std_acceleration': np.std(accelerations) if accelerations else 0,
                'avg_distance': np.mean(distances) if distances else 0,
                'total_distance': sum(distances),
                'avg_curvature': np.mean(curvatures) if curvatures else 0,
                'movement_efficiency': sum(distances) / len(move_events) if move_events else 0,
                'click_frequency': len(click_events) / len(mouse_events) if mouse_events else 0,
                'total_movements': len(move_events),
                'total_clicks': len(click_events),
                'velocity_variance': np.var(velocities) if velocities else 0,
                'direction_variance': np.var(directions) if directions else 0
            }
            
            # Add pause analysis
            pauses = []
            for i in range(1, len(move_events)):
                time_diff = move_events[i]['timestamp'] - move_events[i - 1]['timestamp']
                if time_diff > 100:  # Pause longer than 100ms
                    pauses.append(time_diff)
            
            features.update({
                'avg_pause_duration': np.mean(pauses) if pauses else 0,
                'pause_frequency': len(pauses) / len(move_events) if move_events else 0,
                'total_pauses': len(pauses)
            })
            
            return features
            
        except Exception as e:
            logger.error(f"Error extracting mouse features: {str(e)}")
            return {}
    
    def extract_scroll_features(self, scroll_events):
        """
        Extract scroll behavior features
        """
        try:
            if not scroll_events:
                return {}
            
            # Extract scroll deltas and speeds
            scroll_speeds = []
            scroll_directions = []
            scroll_accelerations = []
            
            for i, event in enumerate(scroll_events):
                speed = abs(event.get('deltaY', 0))
                scroll_speeds.append(speed)
                
                direction = 1 if event.get('deltaY', 0) > 0 else -1
                scroll_directions.append(direction)
                
                if i > 0:
                    prev_speed = scroll_speeds[i - 1]
                    time_diff = event['timestamp'] - scroll_events[i - 1]['timestamp']
                    acceleration = abs(speed - prev_speed) / time_diff if time_diff > 0 else 0
                    scroll_accelerations.append(acceleration)
            
            # Calculate rhythm and patterns
            scroll_intervals = []
            for i in range(1, len(scroll_events)):
                interval = scroll_events[i]['timestamp'] - scroll_events[i - 1]['timestamp']
                scroll_intervals.append(interval)
            
            # Direction changes
            direction_changes = 0
            for i in range(1, len(scroll_directions)):
                if scroll_directions[i] != scroll_directions[i - 1]:
                    direction_changes += 1
            
            features = {
                'avg_scroll_speed': np.mean(scroll_speeds) if scroll_speeds else 0,
                'std_scroll_speed': np.std(scroll_speeds) if scroll_speeds else 0,
                'avg_scroll_acceleration': np.mean(scroll_accelerations) if scroll_accelerations else 0,
                'avg_scroll_interval': np.mean(scroll_intervals) if scroll_intervals else 0,
                'std_scroll_interval': np.std(scroll_intervals) if scroll_intervals else 0,
                'direction_changes': direction_changes,
                'direction_change_rate': direction_changes / len(scroll_events) if scroll_events else 0,
                'total_scroll_events': len(scroll_events),
                'scroll_consistency': 1.0 - (np.std(scroll_intervals) / np.mean(scroll_intervals)) if scroll_intervals and np.mean(scroll_intervals) > 0 else 0,
                'scroll_speed_variance': np.var(scroll_speeds) if scroll_speeds else 0
            }
            
            return features
            
        except Exception as e:
            logger.error(f"Error extracting scroll features: {str(e)}")
            return {}
    
    def calculate_quality_metrics(self, behavioral_data):
        """
        Calculate quality metrics for behavioral data
        """
        try:
            metrics = {}
            
            # Keystroke quality
            if 'keystroke' in behavioral_data:
                keystroke_events = behavioral_data['keystroke']
                metrics['keystroke'] = min(1.0, len(keystroke_events) / 50.0)  # Normalize by expected minimum
            
            # Mouse quality
            if 'mouse' in behavioral_data:
                mouse_events = behavioral_data['mouse']
                metrics['mouse'] = min(1.0, len(mouse_events) / 100.0)  # Normalize by expected minimum
            
            # Scroll quality
            if 'scroll' in behavioral_data:
                scroll_events = behavioral_data['scroll']
                metrics['scroll'] = min(1.0, len(scroll_events) / 20.0)  # Normalize by expected minimum
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating quality metrics: {str(e)}")
            return {}
    
    def compare_keystroke_patterns(self, current_features, stored_features):
        """
        Compare current keystroke pattern with stored pattern
        """
        try:
            if not current_features or not stored_features:
                return None
            
            # Key features for comparison
            comparison_features = [
                'avg_dwell_time', 'std_dwell_time', 'avg_flight_time', 'std_flight_time',
                'avg_inter_key_interval', 'typing_speed'
            ]
            
            # Extract feature vectors
            current_vector = [current_features.get(f, 0) for f in comparison_features]
            stored_vector = [stored_features.get(f, 0) for f in comparison_features]
            
            # Calculate similarity using cosine similarity
            similarity = cosine_similarity([current_vector], [stored_vector])[0][0]
            
            # Convert to match score (handle NaN)
            match_score = similarity if not np.isnan(similarity) else 0.0
            
            return max(0.0, min(1.0, match_score))
            
        except Exception as e:
            logger.error(f"Error comparing keystroke patterns: {str(e)}")
            return None
    
    def compare_mouse_patterns(self, current_features, stored_features):
        """
        Compare current mouse pattern with stored pattern
        """
        try:
            if not current_features or not stored_features:
                return None
            
            # Key features for comparison
            comparison_features = [
                'avg_velocity', 'std_velocity', 'avg_acceleration', 'movement_efficiency',
                'click_frequency', 'avg_curvature'
            ]
            
            # Extract feature vectors
            current_vector = [current_features.get(f, 0) for f in comparison_features]
            stored_vector = [stored_features.get(f, 0) for f in comparison_features]
            
            # Calculate similarity
            similarity = cosine_similarity([current_vector], [stored_vector])[0][0]
            
            # Convert to match score
            match_score = similarity if not np.isnan(similarity) else 0.0
            
            return max(0.0, min(1.0, match_score))
            
        except Exception as e:
            logger.error(f"Error comparing mouse patterns: {str(e)}")
            return None
    
    def compare_scroll_patterns(self, current_features, stored_features):
        """
        Compare current scroll pattern with stored pattern
        """
        try:
            if not current_features or not stored_features:
                return None
            
            # Key features for comparison
            comparison_features = [
                'avg_scroll_speed', 'std_scroll_speed', 'avg_scroll_interval',
                'direction_change_rate', 'scroll_consistency'
            ]
            
            # Extract feature vectors
            current_vector = [current_features.get(f, 0) for f in comparison_features]
            stored_vector = [stored_features.get(f, 0) for f in comparison_features]
            
            # Calculate similarity
            similarity = cosine_similarity([current_vector], [stored_vector])[0][0]
            
            # Convert to match score
            match_score = similarity if not np.isnan(similarity) else 0.0
            
            return max(0.0, min(1.0, match_score))
            
        except Exception as e:
            logger.error(f"Error comparing scroll patterns: {str(e)}")
            return None
    
    def detect_anomalies(self, features):
        """
        Detect anomalies in behavioral patterns
        """
        try:
            anomalies = []
            anomaly_score = 0.0
            
            # Check keystroke anomalies
            if 'keystroke' in features:
                keystroke_anomalies = self.detect_keystroke_anomalies(features['keystroke'])
                anomalies.extend(keystroke_anomalies)
            
            # Check mouse anomalies
            if 'mouse' in features:
                mouse_anomalies = self.detect_mouse_anomalies(features['mouse'])
                anomalies.extend(mouse_anomalies)
            
            # Check scroll anomalies
            if 'scroll' in features:
                scroll_anomalies = self.detect_scroll_anomalies(features['scroll'])
                anomalies.extend(scroll_anomalies)
            
            # Calculate overall anomaly score
            if anomalies:
                anomaly_score = len(anomalies) / 10.0  # Normalize
                anomaly_score = min(1.0, anomaly_score)
            
            return {
                'is_anomalous': len(anomalies) > 2,
                'score': anomaly_score,
                'types': anomalies,
                'details': f"Detected {len(anomalies)} anomalies"
            }
            
        except Exception as e:
            logger.error(f"Error detecting anomalies: {str(e)}")
            return {
                'is_anomalous': False,
                'score': 0.0,
                'types': [],
                'details': str(e)
            }
    
    def detect_keystroke_anomalies(self, keystroke_features):
        """
        Detect keystroke-specific anomalies
        """
        anomalies = []
        
        # Check for unusually fast typing
        if keystroke_features.get('typing_speed', 0) > 10:  # More than 10 keys per second
            anomalies.append('unusually_fast_typing')
        
        # Check for unusually consistent timing (bot-like behavior)
        if keystroke_features.get('std_dwell_time', 1) < 5:  # Very low variance
            anomalies.append('overly_consistent_timing')
        
        # Check for unusual dwell times
        avg_dwell = keystroke_features.get('avg_dwell_time', 0)
        if avg_dwell < 50 or avg_dwell > 500:  # Outside normal range
            anomalies.append('unusual_dwell_times')
        
        return anomalies
    
    def detect_mouse_anomalies(self, mouse_features):
        """
        Detect mouse-specific anomalies
        """
        anomalies = []
        
        # Check for unusually high velocity
        if mouse_features.get('avg_velocity', 0) > 5:  # Very fast movements
            anomalies.append('unusually_fast_mouse')
        
        # Check for perfectly straight movements (bot-like)
        if mouse_features.get('avg_curvature', 1) < 0.1:
            anomalies.append('overly_straight_movements')
        
        # Check for unusual click patterns
        click_freq = mouse_features.get('click_frequency', 0)
        if click_freq > 0.5:  # More than 50% clicks
            anomalies.append('excessive_clicking')
        
        return anomalies
    
    def detect_scroll_anomalies(self, scroll_features):
        """
        Detect scroll-specific anomalies
        """
        anomalies = []
        
        # Check for unusually fast scrolling
        if scroll_features.get('avg_scroll_speed', 0) > 1000:
            anomalies.append('unusually_fast_scrolling')
        
        # Check for overly consistent scrolling
        if scroll_features.get('scroll_consistency', 0) > 0.95:
            anomalies.append('overly_consistent_scrolling')
        
        # Check for unusual direction changes
        if scroll_features.get('direction_change_rate', 0) > 0.8:
            anomalies.append('excessive_direction_changes')
        
        return anomalies
    
    def assess_risk(self, assessment_data):
        """
        Assess overall risk based on behavioral analysis
        """
        try:
            behavioral_score = assessment_data.get('behavioral_score', 0.5)
            anomaly_score = assessment_data.get('anomaly_score', 0)
            data_quality = assessment_data.get('data_quality', {})
            
            # Calculate risk factors
            risk_factors = []
            
            if behavioral_score < 0.4:
                risk_factors.append('low_behavioral_match')
            
            if anomaly_score > 0.7:
                risk_factors.append('high_anomaly_score')
            
            # Check data quality
            avg_quality = np.mean(list(data_quality.values())) if data_quality else 0.5
            if avg_quality < 0.3:
                risk_factors.append('poor_data_quality')
            
            # Calculate overall risk level
            risk_score = (
                (1.0 - behavioral_score) * 0.5 +
                anomaly_score * 0.3 +
                (1.0 - avg_quality) * 0.2
            )
            
            if risk_score > 0.7:
                risk_level = 'high'
            elif risk_score > 0.4:
                risk_level = 'medium'
            else:
                risk_level = 'low'
            
            return {
                'risk_level': risk_level,
                'risk_score': risk_score,
                'risk_factors': risk_factors,
                'recommendation': self.get_risk_recommendation(risk_level, risk_factors)
            }
            
        except Exception as e:
            logger.error(f"Error assessing risk: {str(e)}")
            return {
                'risk_level': 'medium',
                'risk_score': 0.5,
                'risk_factors': ['assessment_error'],
                'recommendation': 'Manual review recommended'
            }
    
    def get_risk_recommendation(self, risk_level, risk_factors):
        """
        Get recommendation based on risk assessment
        """
        if risk_level == 'high':
            return 'Block access and require additional verification'
        elif risk_level == 'medium':
            return 'Allow with increased monitoring'
        else:
            return 'Allow normal access'
    
    def real_time_analysis(self, behavioral_data):
        """
        Perform real-time behavioral analysis
        """
        try:
            # Extract features
            features = self.extract_features(behavioral_data)
            
            # Quick anomaly detection
            anomalies = self.detect_anomalies(features)
            
            # Calculate confidence
            confidence = 1.0 - anomalies.get('score', 0)
            
            return {
                'analysis_type': 'real_time',
                'confidence': confidence,
                'anomalies': anomalies,
                'features': features,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in real-time analysis: {str(e)}")
            return {
                'analysis_type': 'real_time',
                'confidence': 0.5,
                'error': str(e)
            }
    
    def session_analysis(self, behavioral_data):
        """
        Perform session-level behavioral analysis
        """
        try:
            # More comprehensive analysis for session data
            features = self.extract_features(behavioral_data)
            anomalies = self.detect_anomalies(features)
            
            # Session-specific metrics
            session_duration = self.calculate_session_duration(behavioral_data)
            activity_level = self.calculate_activity_level(behavioral_data)
            
            return {
                'analysis_type': 'session',
                'features': features,
                'anomalies': anomalies,
                'session_duration': session_duration,
                'activity_level': activity_level,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in session analysis: {str(e)}")
            return {
                'analysis_type': 'session',
                'error': str(e)
            }
    
    def comprehensive_analysis(self, behavioral_data):
        """
        Perform comprehensive behavioral analysis
        """
        try:
            # Full analysis with all available methods
            features = self.extract_features(behavioral_data)
            anomalies = self.detect_anomalies(features)
            risk_assessment = self.assess_risk({
                'behavioral_score': 0.7,  # Default score
                'anomaly_score': anomalies.get('score', 0),
                'data_quality': features.get('quality_metrics', {})
            })
            
            return {
                'analysis_type': 'comprehensive',
                'features': features,
                'anomalies': anomalies,
                'risk_assessment': risk_assessment,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in comprehensive analysis: {str(e)}")
            return {
                'analysis_type': 'comprehensive',
                'error': str(e)
            }
    
    def calculate_session_duration(self, behavioral_data):
        """
        Calculate session duration from behavioral data
        """
        try:
            all_timestamps = []
            
            for data_type in ['keystroke', 'mouse', 'scroll']:
                if data_type in behavioral_data:
                    timestamps = [event.get('timestamp', 0) for event in behavioral_data[data_type]]
                    all_timestamps.extend(timestamps)
            
            if all_timestamps:
                duration = max(all_timestamps) - min(all_timestamps)
                return duration / 1000.0  # Convert to seconds
            
            return 0.0
            
        except Exception as e:
            logger.error(f"Error calculating session duration: {str(e)}")
            return 0.0
    
    def calculate_activity_level(self, behavioral_data):
        """
        Calculate activity level during session
        """
        try:
            total_events = 0
            
            for data_type in ['keystroke', 'mouse', 'scroll']:
                if data_type in behavioral_data:
                    total_events += len(behavioral_data[data_type])
            
            session_duration = self.calculate_session_duration(behavioral_data)
            
            if session_duration > 0:
                activity_rate = total_events / session_duration
                return min(1.0, activity_rate / 10.0)  # Normalize
            
            return 0.0
            
        except Exception as e:
            logger.error(f"Error calculating activity level: {str(e)}")
            return 0.0
    
    def generate_insights(self, analysis_result):
        """
        Generate insights from analysis results
        """
        insights = []
        
        if 'anomalies' in analysis_result:
            anomaly_score = analysis_result['anomalies'].get('score', 0)
            if anomaly_score > 0.5:
                insights.append(f"High anomaly score detected: {anomaly_score:.2f}")
        
        if 'risk_assessment' in analysis_result:
            risk_level = analysis_result['risk_assessment'].get('risk_level', 'unknown')
            insights.append(f"Risk level assessed as: {risk_level}")
        
        if 'features' in analysis_result:
            features = analysis_result['features']
            if 'keystroke' in features:
                typing_speed = features['keystroke'].get('typing_speed', 0)
                insights.append(f"Typing speed: {typing_speed:.1f} keys/second")
        
        return insights
    
    def get_security_recommendations(self, analysis_result):
        """
        Get security recommendations based on analysis
        """
        recommendations = []
        
        if 'risk_assessment' in analysis_result:
            risk_level = analysis_result['risk_assessment'].get('risk_level', 'medium')
            
            if risk_level == 'high':
                recommendations.extend([
                    "Require additional authentication factors",
                    "Implement session monitoring",
                    "Consider blocking suspicious activity"
                ])
            elif risk_level == 'medium':
                recommendations.extend([
                    "Increase monitoring frequency",
                    "Log detailed activity patterns"
                ])
            else:
                recommendations.append("Continue normal monitoring")
        
        return recommendations