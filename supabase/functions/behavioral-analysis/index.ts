import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BehavioralData {
  user_id: string
  keystroke_events: KeystrokeEvent[]
  mouse_events: MouseEvent[]
  scroll_events: ScrollEvent[]
  timestamp: number
}

interface KeystrokeEvent {
  key: string
  code: string
  timestamp: number
  type: 'keydown' | 'keyup'
}

interface MouseEvent {
  x: number
  y: number
  timestamp: number
  type: 'mousemove' | 'click'
  button?: number
}

interface ScrollEvent {
  deltaX: number
  deltaY: number
  deltaZ: number
  timestamp: number
  type: 'scroll'
}

class BehavioralAnalyzer {
  private static readonly ANOMALY_THRESHOLD = 0.7
  
  static extractKeystrokeFeatures(events: KeystrokeEvent[]): any {
    const features = {
      avgDwellTime: 0,
      avgFlightTime: 0,
      typingRhythm: 0,
      keyPressureVariation: 0,
      pausePatterns: []
    }
    
    const dwellTimes: number[] = []
    const flightTimes: number[] = []
    
    for (let i = 0; i < events.length - 1; i++) {
      const current = events[i]
      const next = events[i + 1]
      
      if (current.type === 'keydown' && next.type === 'keyup' && current.key === next.key) {
        dwellTimes.push(next.timestamp - current.timestamp)
      }
      
      if (current.type === 'keyup' && next.type === 'keydown') {
        flightTimes.push(next.timestamp - current.timestamp)
      }
    }
    
    features.avgDwellTime = dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length || 0
    features.avgFlightTime = flightTimes.reduce((a, b) => a + b, 0) / flightTimes.length || 0
    features.typingRhythm = this.calculateVariance(flightTimes)
    
    return features
  }
  
  static extractMouseFeatures(events: MouseEvent[]): any {
    const features = {
      avgVelocity: 0,
      avgAcceleration: 0,
      movementPattern: 0,
      clickFrequency: 0,
      trajectorySmoothing: 0
    }
    
    const velocities: number[] = []
    const accelerations: number[] = []
    let clickCount = 0
    
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1]
      const curr = events[i]
      
      if (curr.type === 'click') {
        clickCount++
        continue
      }
      
      if (prev.type === 'mousemove' && curr.type === 'mousemove') {
        const distance = Math.sqrt(
          Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
        )
        const timeDiff = curr.timestamp - prev.timestamp
        const velocity = distance / timeDiff
        velocities.push(velocity)
        
        if (i > 1 && velocities.length > 1) {
          const acceleration = Math.abs(velocity - velocities[velocities.length - 2])
          accelerations.push(acceleration)
        }
      }
    }
    
    features.avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length || 0
    features.avgAcceleration = accelerations.reduce((a, b) => a + b, 0) / accelerations.length || 0
    features.clickFrequency = clickCount / (events.length || 1)
    features.movementPattern = this.calculateVariance(velocities)
    
    return features
  }
  
  static extractScrollFeatures(events: ScrollEvent[]): any {
    const features = {
      avgScrollSpeed: 0,
      scrollDirection: 0,
      scrollRhythm: 0,
      scrollAcceleration: 0
    }
    
    const speeds: number[] = []
    const directions: number[] = []
    
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1]
      const curr = events[i]
      
      const timeDiff = curr.timestamp - prev.timestamp
      const speed = Math.abs(curr.deltaY) / timeDiff
      speeds.push(speed)
      
      directions.push(Math.sign(curr.deltaY))
    }
    
    features.avgScrollSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length || 0
    features.scrollDirection = directions.reduce((a, b) => a + b, 0) / directions.length || 0
    features.scrollRhythm = this.calculateVariance(speeds)
    
    return features
  }
  
  private static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
    return Math.sqrt(variance)
  }
  
  static calculateAnomalyScore(currentFeatures: any, baselineFeatures: any): number {
    if (!baselineFeatures) return 0
    
    let totalScore = 0
    let featureCount = 0
    
    // Compare keystroke features
    if (currentFeatures.keystroke && baselineFeatures.keystroke) {
      const keystrokeScore = this.compareFeatures(currentFeatures.keystroke, baselineFeatures.keystroke)
      totalScore += keystrokeScore
      featureCount++
    }
    
    // Compare mouse features
    if (currentFeatures.mouse && baselineFeatures.mouse) {
      const mouseScore = this.compareFeatures(currentFeatures.mouse, baselineFeatures.mouse)
      totalScore += mouseScore
      featureCount++
    }
    
    // Compare scroll features
    if (currentFeatures.scroll && baselineFeatures.scroll) {
      const scrollScore = this.compareFeatures(currentFeatures.scroll, baselineFeatures.scroll)
      totalScore += scrollScore
      featureCount++
    }
    
    return featureCount > 0 ? totalScore / featureCount : 0
  }
  
  private static compareFeatures(current: any, baseline: any): number {
    let score = 0
    let count = 0
    
    for (const key in baseline) {
      if (current[key] !== undefined && baseline[key] !== undefined) {
        const diff = Math.abs(current[key] - baseline[key])
        const normalizedDiff = diff / (baseline[key] + 1) // Add 1 to avoid division by zero
        score += Math.min(normalizedDiff, 1) // Cap at 1
        count++
      }
    }
    
    return count > 0 ? score / count : 0
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const behavioralData: BehavioralData = await req.json()
    
    // Extract features from current session
    const currentFeatures = {
      keystroke: BehavioralAnalyzer.extractKeystrokeFeatures(behavioralData.keystroke_events),
      mouse: BehavioralAnalyzer.extractMouseFeatures(behavioralData.mouse_events),
      scroll: BehavioralAnalyzer.extractScrollFeatures(behavioralData.scroll_events)
    }
    
    // Get baseline features from database
    const { data: baselineData } = await supabaseClient
      .from('biometric_data')
      .select('data')
      .eq('user_id', user.id)
      .eq('biometric_type', 'keystroke')
      .order('capture_timestamp', { ascending: false })
      .limit(1)
      .single()
    
    const baselineFeatures = baselineData?.data?.features
    
    // Calculate anomaly score
    const anomalyScore = BehavioralAnalyzer.calculateAnomalyScore(currentFeatures, baselineFeatures)
    
    // Determine if this is anomalous
    const isAnomalous = anomalyScore > BehavioralAnalyzer.ANOMALY_THRESHOLD
    
    // Store behavioral session
    await supabaseClient
      .from('behavioral_sessions')
      .insert({
        user_id: user.id,
        keystroke_events: behavioralData.keystroke_events,
        mouse_events: behavioralData.mouse_events,
        scroll_events: behavioralData.scroll_events,
        anomaly_score: anomalyScore
      })
    
    // Log anomaly if detected
    if (isAnomalous) {
      await supabaseClient
        .from('anomaly_audit')
        .insert({
          user_id: user.id,
          anomaly_type: 'behavioral_deviation',
          score: anomalyScore,
          action: 'monitor',
          details: {
            features: currentFeatures,
            baseline: baselineFeatures,
            threshold: BehavioralAnalyzer.ANOMALY_THRESHOLD
          }
        })
    }
    
    const response = {
      status: 'success',
      anomaly_detected: isAnomalous,
      anomaly_score: anomalyScore,
      threshold: BehavioralAnalyzer.ANOMALY_THRESHOLD,
      features: currentFeatures,
      action: isAnomalous ? 'monitor' : 'continue'
    }
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error in behavioral analysis:', error)
    
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error.message,
        anomaly_detected: false,
        action: 'continue'
      }),
      { 
        status: 200, // Return 200 to avoid breaking the client
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})