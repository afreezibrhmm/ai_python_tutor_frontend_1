import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Tutor() {
  const navigate = useNavigate();
  
  // Input states
  const [code, setCode] = useState('def greet_user():\n    print("Hello, welcome to your AI terminal!")\n\ngreet_user()');
  const [topic, setTopic] = useState('Functions and Scope');
  const [loading, setLoading] = useState(false);
  
  // Output states that perfectly match the new backend JSON
  const [terminalResult, setTerminalResult] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [concept, setConcept] = useState('');
  const [objective, setObjective] = useState('');

  // The Bouncer
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/login');
  }, [navigate]);

  const handleEvaluate = async () => {
    setLoading(true);
    setTerminalResult('');
    setAnalysis('');
    
    try {
      const token = localStorage.getItem('token'); 
      
      // 👇 Hardcoded perfectly for your local laptop test
      const response = await axios.post('http://127.0.0.1:8000/api/evaluate', {
        current_topic: topic,
        student_code: code
      }, {
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      setTerminalResult(response.data.terminal);
      setAnalysis(response.data.analysis);
      setConcept(response.data.concept);
      setObjective(response.data.objective);

    } catch (error) {
      console.error("Evaluation failed", error);
      setTerminalResult("Error connecting. Check the F12 console!");
    }
    setLoading(false);
  };


  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div style={{ padding: '40px', display: 'flex', gap: '40px', backgroundColor: '#fafafa', minHeight: '100vh', fontFamily: '"Segoe UI", sans-serif' }}>
      
      {/* LEFT COLUMN: AI Feedback */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>🤖 AI Python Mentor</h2>
          <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Exit</button>
        </div>

        {!analysis ? (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'white', borderRadius: '12px', border: '2px dashed #e5e7eb', color: '#6b7280' }}>
            <h3>No evaluation data yet</h3>
            <p>Write code on the right and hit "Run & Evaluate" to wake up the tutor.</p>
          </div>
        ) : (
          <>
            {/* Analysis Box */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Tutor Analysis</h4>
              <p style={{ margin: 0, color: '#111827', lineHeight: '1.6' }}>{analysis}</p>
            </div>

            {/* Concept Box */}
            <div style={{ backgroundColor: '#f0fdf4', padding: '24px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#166534', textTransform: 'uppercase', fontSize: '12px', fontWeight: 'bold' }}>Concept Focus</h4>
              <p style={{ margin: 0, color: '#15803d' }}>{concept}</p>
            </div>

            {/* Objective Box */}
            <div style={{ backgroundColor: '#eff6ff', padding: '24px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1e40af', fontSize: '14px' }}>Next Objective</h4>
              <p style={{ margin: 0, color: '#1e3a8a' }}>{objective}</p>
            </div>
          </>
        )}
      </div>

      {/* RIGHT COLUMN: Code Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
           <h3 style={{ margin: '0 0 10px 0' }}>Current Module: {topic}</h3>
           <textarea 
             value={code}
             onChange={(e) => setCode(e.target.value)}
             style={{ width: '100%', height: '300px', backgroundColor: '#1e1e1e', color: '#d4d4d4', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px', border: 'none', resize: 'vertical' }}
           />
        </div>

        <div style={{ backgroundColor: '#111827', padding: '20px', borderRadius: '12px', color: '#f3f4f6' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Console Output</h4>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: terminalResult.includes('Error') ? '#ef4444' : '#10b981' }}>
            {terminalResult || "Terminal ready..."}
          </pre>
        </div>

        <button 
          onClick={handleEvaluate} 
          disabled={loading}
          style={{ width: '100%', padding: '16px', backgroundColor: loading ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}
        >
          {loading ? 'Evaluating...' : 'Run & Evaluate Code'}
        </button>
      </div>

    </div>
  );
}