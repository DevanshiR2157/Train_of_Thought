import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const AdaptiveTrolleySimulator = ({ onComplete }) => {
  const [data, setData] = useState([]);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [userChoices, setUserChoices] = useState([]);
  const [stage, setStage] = useState('loading');
  const [scenarioCount, setScenarioCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDataset();
  }, []);

  const loadDataset = async () => {
    try {
      // Correct path based on your structure: trolley.csv is in root
      const response = await fetch('../trolley.csv');
      
      if (!response.ok) {
        throw new Error('Could not load trolley.csv');
      }
      
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: async (results) => {
          if (results.data && results.data.length > 0) {
            console.log('✅ Dataset loaded:', results.data.length, 'rows');
            setData(results.data);
            setStage('playing');
            await generateAIScenario(results.data, []);
          } else {
            throw new Error('Dataset is empty');
          }
        },
        error: (error) => {
          console.error('Parse error:', error);
          setError('Error parsing CSV: ' + error.message);
          setStage('error');
        }
      });
    } catch (err) {
      console.error('Error loading dataset:', err);
      setError('Error loading trolley.csv from root directory: ' + err.message);
      setStage('error');
    }
  };

  const generateAIScenario = async (dataset, choices) => {
    setLoading(true);
    
    try {
      const conversationHistory = choices.map((choice) => ({
        scenario: choice.scenario,
        userChoice: choice.choice,
        saved: choice.saved,
        sacrificed: choice.sacrificed
      }));

      const sampleData = dataset
        .sort(() => Math.random() - 0.5)
        .slice(0, 10)
        .map(row => `Sample response: ${JSON.stringify(row)}`)
        .join('\n');

      const prompt = `You are an AI ethics researcher creating adaptive trolley problem scenarios.

DATASET CONTEXT (sample of real human responses from trolley.csv):
${sampleData}

USER'S PREVIOUS CHOICES (${choices.length} scenarios completed):
${choices.length === 0 ? 'This is the first scenario.' : JSON.stringify(conversationHistory, null, 2)}

YOUR TASK:
1. Analyze the user's choice patterns (age, gender, fitness, social status, quantity preferences)
2. Generate a NEW, UNIQUE trolley problem scenario with TWO DIFFERENT OPTIONS
3. Make it adaptive: ${choices.length === 0 ? 'Start with a simple scenario' : 'Challenge their emerging patterns or test consistency'}

CRITICAL REQUIREMENTS:
- The two groups must be MEANINGFULLY DIFFERENT (not "1 athletic man" vs "1 athletic man")
- Use realistic characteristics: age (child/young adult/adult/elderly), gender (male/female), fitness (athletic/average/overweight), social status (doctor/executive/teacher/unemployed/homeless)
- Include number variations (1-5 people)
- Make scenarios progressively more complex and challenging
- After scenario 3, actively challenge their strongest preference

Respond ONLY with valid JSON (no markdown, no preamble):
{
  "groupA": {
    "count": number,
    "age": "string",
    "gender": "string", 
    "fitness": "string",
    "status": "string",
    "description": "string (natural description like '2 elderly women' or '1 athletic young doctor')"
  },
  "groupB": {
    "count": number,
    "age": "string",
    "gender": "string",
    "fitness": "string", 
    "status": "string",
    "description": "string"
  },
  "context": "string (brief scenario setup, max 100 chars)",
  "aiInsight": "string (why this scenario was chosen based on their patterns, max 150 chars)"
}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: prompt }
          ],
        })
      });

      const result = await response.json();
      const aiResponse = result.content.find(c => c.type === 'text')?.text || '';
      
      const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
      const scenario = JSON.parse(cleanJson);
      
      setCurrentScenario({
        ...scenario,
        number: choices.length + 1
      });
      setAiInsight(scenario.aiInsight || '');
      setScenarioCount(choices.length + 1);
      
    } catch (error) {
      console.error('Error generating scenario:', error);
      alert('Error generating scenario. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChoice = async (choice) => {
    const saved = choice === 'A' ? currentScenario.groupA : currentScenario.groupB;
    const sacrificed = choice === 'A' ? currentScenario.groupB : currentScenario.groupA;

    const newChoice = {
      scenarioNum: scenarioCount,
      choice: choice,
      saved: saved,
      sacrificed: sacrificed,
      scenario: {
        groupA: currentScenario.groupA,
        groupB: currentScenario.groupB,
        context: currentScenario.context
      },
      timestamp: new Date().toISOString()
    };

    const newChoices = [...userChoices, newChoice];
    setUserChoices(newChoices);

    if (newChoices.length >= 10) {
      // Save to localStorage for dashboard
      localStorage.setItem('trolleyChoices', JSON.stringify(newChoices));
      
      // Redirect to dashboard
      window.location.href = './dashboard.html';
    } else {
      await generateAIScenario(data, newChoices);
    }
  };

  if (stage === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0' }}>
        <div style={{ 
          width: '60px', 
          height: '60px', 
          border: '4px solid #f3f4f6', 
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          margin: '0 auto 2rem',
          animation: 'spin 1s linear infinite'
        }} />
        <h3 style={{ color: '#667eea', marginBottom: '0.5rem' }}>Loading Dataset</h3>
        <p style={{ color: '#666' }}>Loading trolley.csv from repository...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ color: '#dc2626', marginBottom: '1rem' }}>Error Loading Dataset</h3>
        <p style={{ color: '#666', marginBottom: '2rem' }}>{error}</p>
        <button 
          onClick={loadDataset}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '0.75rem 2rem',
            borderRadius: '50px',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (stage === 'playing') {
    const progress = (userChoices.length / 10) * 100;

    return (
      <div>
        {/* Progress Bar */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            color: '#666', 
            marginBottom: '0.5rem',
            fontSize: '0.9rem'
          }}>
            <span>Scenario {scenarioCount} of 10</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div style={{ 
            width: '100%', 
            background: '#e5e7eb', 
            borderRadius: '50px', 
            height: '8px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: `${progress}%`, 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              height: '100%',
              transition: 'width 0.3s ease',
              borderRadius: '50px'
            }} />
          </div>
        </div>

        {/* AI Insight */}
        {aiInsight && userChoices.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
            padding: '1.5rem',
            borderRadius: '15px',
            marginBottom: '2rem',
            border: '1px solid rgba(102, 126, 234, 0.2)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginBottom: '0.5rem'
            }}>
              <span style={{ fontSize: '1.2rem' }}>🧠</span>
              <strong style={{ color: '#667eea' }}>AI Adaptive Insight</strong>
            </div>
            <p style={{ color: '#555', margin: 0 }}>{aiInsight}</p>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              border: '4px solid #f3f4f6', 
              borderTop: '4px solid #667eea',
              borderRadius: '50%',
              margin: '0 auto 2rem',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ color: '#666' }}>AI is analyzing your patterns and generating next scenario...</p>
          </div>
        ) : currentScenario ? (
          <>
            {/* Scenario Context */}
            <div style={{
              background: 'linear-gradient(to right, #fee2e2, #fef3c7)',
              borderLeft: '4px solid #dc2626',
              borderRadius: '0 10px 10px 0',
              padding: '1.5rem',
              marginBottom: '2rem'
            }}>
              <h3 style={{ 
                fontSize: '1.3rem', 
                color: '#333', 
                marginBottom: '0.75rem',
                fontWeight: '600'
              }}>
                {currentScenario.context || "A runaway trolley is heading down the tracks. You can pull a lever to change its path."}
              </h3>
              <p style={{ color: '#666', margin: 0, fontSize: '1.05rem' }}>
                Who do you save?
              </p>
            </div>

            {/* Options Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth > 768 ? '1fr 1fr' : '1fr',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              {/* Option A */}
              <button
                onClick={() => handleChoice('A')}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  borderRadius: '15px',
                  padding: '2rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  color: 'white',
                  textAlign: 'left',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  {currentScenario.groupA.count > 1 ? '👥' : '🧍'}
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  marginBottom: '1rem' 
                }}>
                  Save Option A
                </div>
                <div style={{ 
                  fontSize: '1.1rem', 
                  marginBottom: '0.75rem',
                  fontWeight: '500'
                }}>
                  {currentScenario.groupA.description}
                </div>
                <div style={{ 
                  fontSize: '0.9rem', 
                  opacity: 0.9 
                }}>
                  {currentScenario.groupA.count} {currentScenario.groupA.count > 1 ? 'people' : 'person'}
                </div>
              </button>

              {/* Option B */}
              <button
                onClick={() => handleChoice('B')}
                style={{
                  background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                  border: 'none',
                  borderRadius: '15px',
                  padding: '2rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  color: 'white',
                  textAlign: 'left',
                  boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(168, 85, 247, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.3)';
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  {currentScenario.groupB.count > 1 ? '👥' : '🧍'}
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  marginBottom: '1rem' 
                }}>
                  Save Option B
                </div>
                <div style={{ 
                  fontSize: '1.1rem', 
                  marginBottom: '0.75rem',
                  fontWeight: '500'
                }}>
                  {currentScenario.groupB.description}
                </div>
                <div style={{ 
                  fontSize: '0.9rem', 
                  opacity: 0.9 
                }}>
                  {currentScenario.groupB.count} {currentScenario.groupB.count > 1 ? 'people' : 'person'}
                </div>
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return null;
};

export default AdaptiveTrolleySimulator;
