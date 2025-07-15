import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportLogsToPDF = async (type: 'login' | 'anomaly' | 'users' | 'biometrics' | 'ekyc', data: any[]) => {
  const doc = new jsPDF();
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  
  try {
    if (type === 'login') {
      doc.setFontSize(16);
      doc.text('Login Activity Report', 20, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
      
      const loginColumns = ['Date', 'User', 'Email', 'IP Address', 'Status', 'Failure Reason'];
      const loginRows = data.map(log => [
        new Date(log.event_ts || log.created_at).toLocaleString(),
        log.users?.username || 'Unknown',
        log.users?.email || 'N/A',
        log.ip_addr || 'N/A',
        log.success ? 'Success' : 'Failed',
        log.failure_reason || 'N/A'
      ]);
      
      autoTable(doc, {
        head: [loginColumns],
        body: loginRows,
        startY: 40,
        styles: { fontSize: 8 }
      });
      
      doc.save(`login-report-${timestamp}.pdf`);
      
    } else if (type === 'anomaly') {
      doc.setFontSize(16);
      doc.text('Security Anomalies Report', 20, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
      
      const anomalyColumns = ['Date', 'User', 'Type', 'Score', 'Severity', 'Action', 'Status'];
      const anomalyRows = data.map(anomaly => [
        new Date(anomaly.created_at).toLocaleString(),
        anomaly.users?.username || 'Unknown',
        anomaly.anomaly_type || 'N/A',
        anomaly.anomaly_score?.toFixed(2) || 'N/A',
        anomaly.severity || 'N/A',
        anomaly.action_taken || 'N/A',
        anomaly.resolved ? 'Resolved' : 'Open'
      ]);
      
      autoTable(doc, {
        head: [anomalyColumns],
        body: anomalyRows,
        startY: 40,
        styles: { fontSize: 8 }
      });
      
      doc.save(`anomaly-report-${timestamp}.pdf`);
      
    } else if (type === 'users') {
      doc.setFontSize(16);
      doc.text('Users Report', 20, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
      
      const userColumns = ['Username', 'Email', 'Role', 'Status', 'Trust Score', 'Biometric', 'Created'];
      const userRows = data.map(user => [
        user.username || 'N/A',
        user.email || 'N/A',
        user.role || 'user',
        user.is_active !== false ? 'Active' : 'Inactive',
        `${user.trust_score || 85}%`,
        user.biometric_enrolled ? 'Yes' : 'No',
        new Date(user.created_at).toLocaleDateString()
      ]);
      
      autoTable(doc, {
        head: [userColumns],
        body: userRows,
        startY: 40,
        styles: { fontSize: 8 }
      });
      
      doc.save(`users-report-${timestamp}.pdf`);
      
    } else if (type === 'biometrics') {
      doc.setFontSize(16);
      doc.text('Biometric Sessions Report', 20, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
      
      const bioColumns = ['Date', 'User', 'Type', 'Similarity', 'Success', 'Page Context'];
      const bioRows = data.map(session => [
        new Date(session.created_at).toLocaleString(),
        session.user_id?.slice(-8) + '...' || 'Unknown',
        session.verification_type || 'N/A',
        `${(session.similarity_scores?.overall_similarity * 100 || 0).toFixed(1)}%`,
        session.is_successful ? 'Success' : 'Failed',
        session.page_context || 'N/A'
      ]);
      
      autoTable(doc, {
        head: [bioColumns],
        body: bioRows,
        startY: 40,
        styles: { fontSize: 8 }
      });
      
      doc.save(`biometric-report-${timestamp}.pdf`);
      
    } else if (type === 'ekyc') {
      doc.setFontSize(16);
      doc.text('eKYC Documents Report', 20, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
      
      const ekycColumns = ['Date', 'User', 'Document Type', 'Status', 'Authenticity Score', 'Face Match'];
      const ekycRows = data.map(document => [  // Changed 'doc' to 'document' to avoid conflict
        new Date(document.created_at).toLocaleString(),
        document.users?.username || 'Unknown',
        document.document_type?.toUpperCase() || 'N/A',
        document.verification_status?.toUpperCase() || 'PENDING',
        `${((document.document_authenticity_score || 0) * 100).toFixed(0)}%`,
        `${((document.face_match_score || 0) * 100).toFixed(0)}%`
      ]);
      
      autoTable(doc, {
        head: [ekycColumns],
        body: ekycRows,
        startY: 40,
        styles: { fontSize: 8 }
      });
      
      doc.save(`ekyc-report-${timestamp}.pdf`);
    }
    
    console.log(`✅ ${type} report exported successfully`);
  } catch (error) {
    console.error(`Export failed:`, error);
    alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};