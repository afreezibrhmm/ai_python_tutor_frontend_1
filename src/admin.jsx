import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Admin() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for managing the drill-down view
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    if (role !== 'admin' || !token) {
      navigate('/login');
      return;
    }

    const fetchStudents = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8000/api/admin/students', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudents(response.data);
      } catch (err) {
        if (err.response?.status === 401) navigate('/login');
      }
      setLoading(false);
    };

    fetchStudents();
  }, [navigate, token, role]);

  // Click handler to open a student profile
  const handleViewProfile = async (studentId) => {
    setProfileLoading(true);
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/admin/students/${studentId}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedStudent(response.data);
    } catch (err) {
      console.error("Error fetching student history", err);
    }
    setProfileLoading(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#f3f4f6', minHeight: '100vh', fontFamily: '"Segoe UI", sans-serif' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: '28px' }}>Admin Mission Control</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Track class rosters and individual coding performance.</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          Logout
        </button>
      </div>

      {/* CONDITIONAL VIEW: Show profile if a student is selected, otherwise show roster */}
      {selectedStudent ? (
        <div>
          {/* Back Button */}
          <button 
            onClick={() => setSelectedStudent(null)} 
            style={{ marginBottom: '20px', padding: '8px 16px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            ← Back to Roster
          </button>

          {/* Profile Card */}
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
            <h2 style={{ margin: '0 0 4px 0', color: '#111827' }}>Student Profile: {selectedStudent.username}</h2>
            <p style={{ margin: 0, color: '#6b7280' }}>Total Submissions Analyzed: {selectedStudent.submissions.length}</p>
          </div>

          {/* Submissions Timeline */}
          <h3 style={{ color: '#374151', marginBottom: '15px' }}>Submission History</h3>
          {selectedStudent.submissions.length === 0 ? (
            <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#9ca3af' }}>
              This student hasn't submitted any code to the AI Tutor yet.
            </div>
          ) : (
            selectedStudent.submissions.map((sub) => (
              <div key={sub.id} style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '20px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <div style={{ backgroundColor: '#f9fafb', padding: '15px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', color: '#2563eb' }}>Topic: {sub.topic}</span>
                  <span style={{ color: '#9ca3af', fontSize: '14px' }}>{new Date(sub.timestamp).toLocaleString()}</span>
                </div>
                <div style={{ padding: '20px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>Submitted Code:</h4>
                  <pre style={{ backgroundColor: '#1e1e1e', color: '#d4d4d4', padding: '15px', borderRadius: '6px', overflowX: 'auto', fontFamily: 'monospace' }}>
                    <code>{sub.code}</code>
                  </pre>
                  <h4 style={{ margin: '20px 0 10px 0' }}>AI Tutor Feedback:</h4>
                  <div style={{ backgroundColor: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '15px', borderRadius: '4px', whiteSpace: 'pre-line' }}>
                    {sub.feedback}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* ROSTER TABLE VIEW */
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <h3 style={{ margin: 0, color: '#374151' }}>Student Roster</h3>
          </div>
          
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading roster data...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '16px 20px', color: '#6b7280', fontSize: '14px' }}>Database ID</th>
                  <th style={{ padding: '16px 20px', color: '#6b7280', fontSize: '14px' }}>Username</th>
                  <th style={{ padding: '16px 20px', color: '#6b7280', fontSize: '14px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '16px 20px', color: '#111827', fontWeight: '500' }}>#{student.id}</td>
                    <td style={{ padding: '16px 20px', color: '#374151' }}>{student.username}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <button 
                        onClick={() => handleViewProfile(student.id)}
                        disabled={profileLoading}
                        style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                      >
                        {profileLoading ? 'Loading...' : 'View Progress'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}