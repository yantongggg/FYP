import React, { useState, useEffect } from 'react';
import { FileText, Eye, Shield, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EKYCDocument {
  id: string;
  document_type: string;
  id_document_url: string;
  id_document_back_url: string;
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

  const frontDoc = documents.find((doc) => doc.document_type.toLowerCase().includes('front'));
  const backDoc = documents.find((doc) => doc.document_type.toLowerCase().includes('back'));
  console.log('  BackDoc:', backDoc);

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-green-400">LATEST_VERIFICATION</h3>
          <span className={`px-3 py-1 rounded text-sm font-bold ${
            frontDoc?.verification_status === 'verified'
              ? 'bg-green-600/20 text-green-400 border border-green-500/30'
              : 'bg-red-600/20 text-red-400 border border-red-500/30'
          }`}>
            {frontDoc?.verification_status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Document Type:</p>
            <p className="text-cyan-400 font-bold">{frontDoc?.document_type.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Submitted:</p>
            <p className="text-cyan-400">
              {frontDoc?.created_at ? new Date(frontDoc.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-2">IC Front</p>
            <img src={frontDoc?.id_document_url} alt="IC Front" className="w-full border rounded" />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-2">IC Back</p>
            <img src={backDoc?.id_document_back_url || backDoc?.id_document_url} alt="IC Back" className="w-full border rounded" />
          </div>
        </div>

    
        <div className="flex justify-center gap-6 mt-6 flex-wrap">
          {/* Authenticity */}
          <div className="text-center p-3 bg-green-900/20 border border-green-500/30 rounded w-40">
            <Shield className="h-6 w-6 text-green-400 mx-auto mb-1" />
            <p className="text-sm text-gray-400">Authenticity</p>
            <p className="text-lg font-bold text-green-400">
              {typeof frontDoc?.document_authenticity_score === 'number'
                ? `${(frontDoc.document_authenticity_score * 100).toFixed(0)}%`
                : '0%'}
            </p>
          </div>

          {/* Status */}
          <div className="text-center p-3 bg-purple-900/20 border border-purple-500/30 rounded w-40">
            <CheckCircle className="h-6 w-6 text-purple-400 mx-auto mb-1" />
            <p className="text-sm text-gray-400">Status</p>
            <p className={`text-lg font-bold ${
              frontDoc?.verification_status === 'verified'
                ? 'text-green-400'
                : frontDoc?.verification_status === 'rejected'
                ? 'text-red-400'
                : 'text-yellow-400'
            }`}>
              {frontDoc?.verification_status.toUpperCase()}
            </p>
          </div>
        </div>
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
