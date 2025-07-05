import React, { useState, useEffect } from 'react';
import { FileText, Eye, Shield, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EKYCDocument {
  id: string;
  document_type: string;
  id_document_url: string;
  verification_status: string;
  face_match_score: number;
  document_authenticity_score: number;
  created_at: string;
  extracted_info: any;
}

interface EKYCDocumentViewerProps {
  userId: string;
}

const EKYCDocumentViewer: React.FC<EKYCDocumentViewerProps> = ({ userId }) => {
  const [documents, setDocuments] = useState<EKYCDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [
    , setSelectedDoc] = useState<EKYCDocument | null>(null);

  useEffect(() => {
    loadEKYCDocuments();
  }, [userId]);

  const loadEKYCDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('ekyc_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading eKYC documents:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-cyan-400">Loading eKYC documents...</div>;
  }

  if (documents.length === 0) {
    return (
      <div className="text-center p-8 glass-card rounded-lg">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400 font-mono">NO_eKYC_DOCUMENTS_FOUND</p>
      </div>
    );
  }

  const latestDoc = documents[0];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-green-400">LATEST_VERIFICATION</h3>
          <span className={`px-3 py-1 rounded text-sm font-bold ${
            latestDoc.verification_status === 'verified' 
              ? 'bg-green-600/20 text-green-400 border border-green-500/30'
              : 'bg-red-600/20 text-red-400 border border-red-500/30'
          }`}>
            {latestDoc.verification_status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Document Type:</p>
            <p className="text-cyan-400 font-bold">{latestDoc.document_type.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Submitted:</p>
            <p className="text-cyan-400">{new Date(latestDoc.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-900/20 border border-blue-500/30 rounded">
            <Eye className="h-6 w-6 text-blue-400 mx-auto mb-1" />
            <p className="text-sm text-gray-400">Face Match</p>
            <p className="text-lg font-bold text-blue-400">
              {(latestDoc.face_match_score * 100).toFixed(0)}%
            </p>
          </div>
          <div className="text-center p-3 bg-green-900/20 border border-green-500/30 rounded">
            <Shield className="h-6 w-6 text-green-400 mx-auto mb-1" />
            <p className="text-sm text-gray-400">Authenticity</p>
            <p className="text-lg font-bold text-green-400">
              {(latestDoc.document_authenticity_score * 100).toFixed(0)}%
            </p>
          </div>
          <div className="text-center p-3 bg-purple-900/20 border border-purple-500/30 rounded">
            <CheckCircle className="h-6 w-6 text-purple-400 mx-auto mb-1" />
            <p className="text-sm text-gray-400">Status</p>
            <p className="text-lg font-bold text-purple-400">
              {latestDoc.verification_status === 'verified' ? 'VERIFIED' : 'PENDING'}
            </p>
          </div>
        </div>

        {latestDoc.extracted_info && (
          <div className="mt-4 p-4 bg-black/30 rounded">
            <h4 className="text-sm font-bold text-green-400 mb-2">EXTRACTED_INFORMATION</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {Object.entries(latestDoc.extracted_info).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-400">{key.replace(/_/g, ' ').toUpperCase()}:</span>
                  <span className="text-cyan-400">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-400 font-mono">
          eKYC documents are securely stored and cannot be re-uploaded.
          Contact support for any verification issues.
        </p>
      </div>
    </div>
  );
};

export default EKYCDocumentViewer;