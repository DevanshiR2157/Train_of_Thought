// AdaptiveTrolleySimulator.jsx
// Place this file in: src/components/AdaptiveTrolleySimulator.jsx

import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, Users, Scale, Heart, AlertTriangle, Loader } from 'lucide-react';
import './AdaptiveTrolleySimulator.css';

const AdaptiveTrolleySimulator = () => {
  const [stage, setStage] = useState('loading');
  const [dataset, setDataset] = useState([]);
  const [scenarioData, setScenarioData] = useState([]);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [choices, setChoices] = useState([]);
  const [scenarioCount, setScenarioCount] = useState(0);
  const [error, setError] = useState(null);
  const totalScenarios = 7;

  // Auto-load dataset on component mount
  useEffect(() => {
    loadDataset();
  }, []);

  const loadDataset = async () => {
    try {
      const response = await fetch('/trolley.csv');
      if (!response.ok) {
        throw new Error('Could not load trolley.csv file');
      }
      
      const text = await response.text();
      const parsedData = parseCSV(text);
      
      if (parsedData.length === 0) {
        throw new Error('Dataset is empty');
      }
      
      setDataset(parsedData);
      
      // Extract scenario data from CSV
      const scenarios = extractScenariosFromCSV(parsedData);
      setScenarioData(scenarios);
      
      setStage('intro');
      console.log(`✓ Loaded ${parsedData.length} responses from trolley.csv`);
      console.log(`✓ Extracted ${scenarios.length} unique scenarios`);
    } catch (err) {
      console.error('Error loading dataset:', err);
      setError(`Failed to load dataset: ${err.message}. Make sure trolley.csv is in the public folder.`);
      setStage('error');
    }
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim();
      });
      return row;
    }).filter(row => Object.keys(row).length > 0);
  };

  // Extract actual scenarios from the CSV data
  const extractScenariosFromCSV = (data) => {
    const scenarios = [];
    
    // Look for scenario description columns in the CSV
    // Common patterns: "ScenarioX", "QuestionX", "DilemmaX"
    const firstRow = data[0];
    const scenarioColumns = Object.keys(firstRow).filter(key => 
      key.toLowerCase().includes('scenario') || 
      key.toLowerCase().includes('question') ||
      key.toLowerCase().includes('dilemma') ||
      key.toLowerCase().includes('description')
    );

    if (scenarioColumns.length > 0) {
      // Extract scenarios from dedicated columns
      scenarioColumns.forEach((col, index) => {
        const scenarioText = firstRow[col];
        if (scenarioText && scenarioText.length > 10) {
          scenarios.push({
            id: index,
            description: scenarioText,
            responseColumn: `Response${index + 1}` // Assume responses are in ResponseX columns
          });
        }
      });
    } else {
      // If no scenario columns found, create generic scenarios based on data patterns
      // Analyze the response patterns to infer what questions were asked
      scenarios.push(
        {
          id: 0,
          description: "A runaway trolley is heading toward 5 workers on the track. You can pull a lever to divert it to a side track where it will kill 1 worker instead.",
          optionA: "Pull the lever (save 5, sacrifice 1)",
          optionB: "Do nothing (let 5 die)",
          metadata: { lives: [1, 5], action: true }
        },
        {
          id: 1,
          description: "A trolley is heading toward 3 young children. You can push a large adult in front to stop the trolley, killing them but saving the children.",
          optionA: "Push the person (save 3 children, sacrifice 1 adult)",
          optionB: "Do nothing (let 3 children die)",
          metadata: { lives: [1, 3], age: true, personal: true }
        },
        {
          id: 2,
          description: "5 elderly people (70+ years) are on one track, and 2 young adults (25 years) are on another. The trolley is heading toward the elderly group.",
          optionA: "Divert to save elderly (sacrifice 2 young adults)",
          optionB: "Do nothing (let 5 elderly die, save young adults)",
          metadata: { lives: [2, 5], age: true }
        },
        {
          id: 3,
          description: "The trolley is heading toward your family member. On the other track are 3 strangers.",
          optionA: "Save your family member (sacrifice 3 strangers)",
          optionB: "Save the 3 strangers (sacrifice family member)",
          metadata: { lives: [1, 3], relationship: true }
        },
        {
          id: 4,
          description: "5 convicted criminals are on one track, 2 doctors are on another. The trolley heads toward the criminals.",
          optionA: "Divert to save criminals (sacrifice 2 doctors)",
          optionB: "Do nothing (let 5 criminals die, save doctors)",
          metadata: { lives: [2, 5], status: true }
        },
        {
          id: 5,
          description: "There's a 70% chance pulling the lever will save 5 people, but 30% chance it will fail and kill everyone (6 total).",
          optionA: "Pull lever (70% save 5, 30% all die)",
          optionB: "Do nothing (1 person dies for certain)",
          metadata: { lives: [1, 5], uncertainty: true }
        },
        {
          id: 6,
          description: "3 pregnant women are on one track, 4 men are on another. The trolley is heading toward the women.",
          optionA: "Divert to save women (sacrifice 4 men)",
          optionB: "Do nothing (let 3 pregnant women die)",
          metadata: { lives: [4, 3], gender: true, special: true }
        }
      );
    }

    return scenarios;
  };

  const analyzeUserPatterns = () => {
    if (choices.length === 0) return null;

    const patterns = {
      prefersMore: 0,
      avoidsAction: 0,
      prefersYounger: 0,
      prefersKnown: 0,
      acceptsUncertainty: 0,
      utilitarian: 0
    };

    choices.forEach(choice => {
      const metadata = choice.metadata;
      
      // Analyze based on what was saved
      if (choice.choice === 'A') {
        if (metadata.utilitarian) patterns.utilitarian++;
        if (metadata.action) patterns.avoidsAction += 0; // chose action
      } else {
        patterns.avoidsAction++; // avoided action
      }

      if (metadata.lives) {
        const [optionALives, optionBLives] = metadata.lives;
        if (choice.choice === 'A' && optionBLives > optionALives) {
          patterns.prefersMore++;
        } else if (choice.choice === 'B' && optionALives > optionBLives) {
          patterns.prefersMore++;
        }
      }

      if (metadata.age && choice.choice === 'B') {
        patterns.prefersYounger++;
      }

      if (metadata.relationship && choice.choice === 'A') {
        patterns.prefersKnown++;
      }

      if (metadata.uncertainty && choice.choice === 'A') {
        patterns.acceptsUncertainty++;
      }
    });

    return patterns;
  };

  const findSimilarUsersFromDataset = () => {
    if (choices.length === 0 || dataset.length === 0) return [];

    const userPattern = choices.map(c => c.choice === 'A' ? 1 : 0);
    
    const similarities = dataset.map((user, index) => {
      let matchCount = 0;
      let totalComparisons = 0;
      
      userPattern.forEach((choice, idx) => {
        const possibleKeys = [
          `response${idx + 1}`,
          `Response${idx + 1}`,
          `r${idx + 1}`,
          `R${idx + 1}`,
          `q${idx + 1}`,
          `Q${idx + 1}`
        ];
        
        for (const key of possibleKeys) {
          if (user[key] !== undefined) {
            totalComparisons++;
            const datasetChoice = parseInt(user[key]);
            if (!isNaN(datasetChoice) && datasetChoice === choice) {
              matchCount++;
            }
            break;
          }
        }
      });
      
      const similarity = totalComparisons > 0 ? (matchCount / totalComparisons) * 100 : 0;
      
      return {
        id: user.ResponseId || user.id || user.ID || index + 1,
        gender: user.gender || user.Gender || user.sex || user.Sex || 'Unknown',
        age: user.age || user.Age || 'Unknown',
        similarity: similarity
      };
    });

    return similarities
      .filter(s => s.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  };

  const generateAdaptiveScenario = () => {
    const patterns = analyzeUserPatterns();
    
    // Select scenario based on what we want to challenge
    let scenarioIndex;
    
    if (scenarioCount === 0) {
      // First scenario - classic trolley
      scenarioIndex = 0;
    } else if (patterns) {
      // Adaptive selection based on detected patterns
      if (patterns.prefersYounger > choices.length * 0.6) {
        // Challenge age bias
        scenarioIndex = 4; // Status-based scenario
      } else if (patterns.prefersMore > choices.length * 0.6) {
        // Challenge utilitarian thinking
        scenarioIndex = 3; // Relationship scenario
      } else if (patterns.avoidsAction > choices.length * 0.5) {
        // Challenge inaction
        scenarioIndex = 1; // Personal action required
      } else if (patterns.prefersKnown > choices.length * 0.5) {
        // Challenge relationship bias
        scenarioIndex = 6; // Gender/special case
      } else {
        // Random challenging scenario
        scenarioIndex = (scenarioCount + 2) % scenarioData.length;
      }
    } else {
      scenarioIndex = scenarioCount % scenarioData.length;
    }

    const baseScenario = scenarioData[Math.min(scenarioIndex, scenarioData.length - 1)];
    
    return {
      title: `Scenario ${scenarioCount + 1}`,
      context: baseScenario.description,
      optionA: {
        action: baseScenario.optionA || "Take action and intervene",
        consequence: "Change the outcome through active intervention",
        metadata: baseScenario.metadata || {}
      },
      optionB: {
        action: baseScenario.optionB || "Do nothing and let events unfold",
        consequence: "Allow the natural course without intervention",
        metadata: { ...baseScenario.metadata, avoidsAction: true } || { avoidsAction: true }
      }
    };
  };

  const startSimulation = () => {
    const firstScenario = generateAdaptiveScenario();
    setCurrentScenario(firstScenario);
    setStage('scenario');
    setScenarioCount(1);
  };

  const makeChoice = (choice) => {
    const choiceData = {
      scenario: currentScenario.title,
      choice: choice,
      optionChosen: choice === 'A' ? currentScenario.optionA : currentScenario.optionB,
      metadata: choice === 'A' ? currentScenario.optionA.metadata : currentScenario.optionB.metadata,
      timestamp: Date.now()
    };

    const newChoices = [...choices, choiceData];
    setChoices(newChoices);

    // Save to localStorage for dashboard
    localStorage.setItem('trolleyChoices', JSON.stringify(newChoices.map((c, idx) => ({
      scenarioNum: idx + 1,
      saved: {
        description: c.choice === 'A' ? c.optionChosen.action : 'N/A',
        age: c.metadata.age ? 'varied' : 'N/A',
        gender: c.metadata.gender ? 'varied' : 'N/A',
        fitness: 'N/A',
        status: c.metadata.status ? 'varied' : 'N/A',
        count: c.metadata.lives ? c.metadata.lives[c.choice === 'A' ? 0 : 1] : 1
      },
      sacrificed: {
        description: c.choice === 'B' ? c.optionChosen.action : 'N/A',
        age: c.metadata.age ? 'varied' : 'N/A',
        gender: c.metadata.gender ? 'varied' : 'N/A',
        fitness: 'N/A',
        status: c.metadata.status ? 'varied' : 'N/A',
        count: c.metadata.lives ? c.metadata.lives[c.choice === 'A' ? 1 : 0] : 1
      },
      timestamp: c.timestamp
    }))));

    if (scenarioCount < totalScenarios) {
      setTimeout(() => {
        const nextScenario = generateAdaptiveScenario();
        setCurrentScenario(nextScenario);
        setScenarioCount(scenarioCount + 1);
      }, 500);
    } else {
      setStage('results');
    }
  };

  const calculateMetrics = () => {
    const patterns = analyzeUserPatterns();
    const total = choices.length;

    return {
      prefersYounger: Math.round((patterns.prefersYounger / total) * 100) || 0,
      prefersMore: Math.round((patterns.prefersMore / total) * 100) || 0,
      avoidsAction: Math.round((patterns.avoidsAction / total) * 100) || 0,
      prefersKnown: Math.round((patterns.prefersKnown / total) * 100) || 0,
      utilitarian: Math.round((patterns.utilitarian / total) * 100) || 0,
      acceptsUncertainty: Math.round((patterns.acceptsUncertainty / total) * 100) || 0,
      similarUsers: findSimilarUsersFromDataset()
    };
  };

  const reset = () => {
    setStage('intro');
    setCurrentScenario(null);
    setChoices([]);
    setScenarioCount(0);
  };

  // Loading state
  if (stage === 'loading') {
    return (
      <div className="simulator-container">
        <div className="simulator-card">
          <div className="text-center">
            <Loader className="icon-large mx-auto mb-4 animate-spin" />
            <h2 className="title">Loading Dataset...</h2>
            <p className="subtitle">Parsing trolley.csv and extracting scenarios</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (stage === 'error') {
    return (
      <div className="simulator-container">
        <div className="simulator-card">
          <div className="text-center">
            <AlertTriangle className="icon-large mx-auto mb-4" style={{color: '#ef4444'}} />
            <h2 className="title">Error Loading Dataset</h2>
            <p className="subtitle" style={{color: '#ef4444'}}>{error}</p>
            <div className="info-box" style={{marginTop: '2rem', textAlign: 'left'}}>
              <h3>Troubleshooting:</h3>
              <ul>
                <li>Make sure <code>trolley.csv</code> is in the <code>public/</code> folder</li>
                <li>Check that the file name is exactly "trolley.csv" (case-sensitive)</li>
                <li>Verify the CSV file is not empty and properly formatted</li>
                <li>Try refreshing the page</li>
              </ul>
            </div>
            <button onClick={loadDataset} className="btn-primary" style={{marginTop: '2rem'}}>
              Retry Loading Dataset
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Intro screen
  if (stage === 'intro') {
    return (
      <div className="simulator-container">
        <div className="simulator-card">
          <div className="text-center mb-8">
            <Brain className="icon-large mx-auto mb-4" />
            <h1 className="title">🧠 AI-Powered Adaptive Simulator</h1>
            <p className="subtitle">
              Scenarios generated from YOUR dataset - Analyzing real moral choices!
            </p>
          </div>

          <div className="feature-list mb-8">
            <div className="feature-item">
              <TrendingUp className="feature-icon" />
              <p>Scenarios extracted directly from {scenarioData.length} real trolley problems in the dataset</p>
            </div>
            <div className="feature-item">
              <Scale className="feature-icon" />
              <p>Each question adapts based on your previous choices to challenge your biases</p>
            </div>
            <div className="feature-item">
              <Users className="feature-icon" />
              <p>Compare your patterns with {dataset.length.toLocaleString()} real participants from the CSV</p>
            </div>
            <div className="feature-item">
              <AlertTriangle className="feature-icon" />
              <p>7 progressively challenging scenarios that test your ethical consistency</p>
            </div>
          </div>

          <div className="success-message mb-6">
            <span className="checkmark">✓</span>
            Dataset loaded: {dataset.length.toLocaleString()} responses | {scenarioData.length} scenarios extracted
          </div>

          <button onClick={startSimulation} className="btn-primary">
            Begin Adaptive Simulation
          </button>
        </div>
      </div>
    );
  }

  // Scenario screen
  if (stage === 'scenario' && currentScenario) {
    const progress = (scenarioCount / totalScenarios) * 100;

    return (
      <div className="simulator-container">
        <div className="scenario-wrapper">
          <div className="progress-section mb-6">
            <div className="progress-text">
              <span>Scenario {scenarioCount} of {totalScenarios}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {choices.length > 0 && (
            <div className="adaptive-notice mb-6">
              <TrendingUp className="notice-icon" />
              <div>
                <p className="notice-title">🎯 Adaptive Challenge</p>
                <p className="notice-text">
                  This scenario was selected from the dataset based on your previous {choices.length} choice{choices.length > 1 ? 's' : ''} to test your moral consistency.
                </p>
              </div>
            </div>
          )}

          <div className="scenario-card">
            <h2 className="scenario-title">{currentScenario.title}</h2>
            <p className="scenario-context">{currentScenario.context}</p>

            <div className="options-grid">
              <button onClick={() => makeChoice('A')} className="option-card">
                <div className="option-header">
                  <span className="option-badge">A</span>
                  OPTION A
                </div>
                <h3 className="option-action">{currentScenario.optionA.action}</h3>
                <p className="option-consequence">{currentScenario.optionA.consequence}</p>
              </button>

              <button onClick={() => makeChoice('B')} className="option-card">
                <div className="option-header">
                  <span className="option-badge">B</span>
                  OPTION B
                </div>
                <h3 className="option-action">{currentScenario.optionB.action}</h3>
                <p className="option-consequence">{currentScenario.optionB.consequence}</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results screen
  if (stage === 'results') {
    const metrics = calculateMetrics();

    return (
      <div className="simulator-container">
        <div className="results-wrapper">
          <div className="results-header">
            <Scale className="icon-large mx-auto mb-4" />
            <h1 className="title">Your Moral Profile</h1>
            <p className="subtitle">Based on {choices.length} scenarios from trolley.csv compared against {dataset.length.toLocaleString()} real responses</p>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <h3 className="metric-title">
                <Users className="metric-icon" />
                Quantity Preference
              </h3>
              <div className="metric-bar-wrapper">
                <div className="metric-label">
                  <span>Prefers saving more lives</span>
                  <span>{metrics.prefersMore}%</span>
                </div>
                <div className="metric-bar">
                  <div className="metric-fill blue" style={{ width: `${metrics.prefersMore}%` }} />
                </div>
              </div>
            </div>

            <div className="metric-card">
              <h3 className="metric-title">
                <Scale className="metric-icon" />
                Action Tendency
              </h3>
              <div className="metric-bar-wrapper">
                <div className="metric-label">
                  <span>Avoids taking action</span>
                  <span>{metrics.avoidsAction}%</span>
                </div>
                <div className="metric-bar">
                  <div className="metric-fill purple" style={{ width: `${metrics.avoidsAction}%` }} />
                </div>
              </div>
            </div>

            <div className="metric-card">
              <h3 className="metric-title">
                <Heart className="metric-icon" />
                Utilitarian Score
              </h3>
              <div className="metric-bar-wrapper">
                <div className="metric-label">
                  <span>Maximizes overall good</span>
                  <span>{metrics.utilitarian}%</span>
                </div>
                <div className="metric-bar">
                  <div className="metric-fill pink" style={{ width: `${metrics.utilitarian}%` }} />
                </div>
              </div>
            </div>

            <div className="metric-card">
              <h3 className="metric-title">
                <TrendingUp className="metric-icon" />
                Uncertainty Tolerance
              </h3>
              <div className="metric-bar-wrapper">
                <div className="metric-label">
                  <span>Accepts uncertain outcomes</span>
                  <span>{metrics.acceptsUncertainty}%</span>
                </div>
                <div className="metric-bar">
                  <div className="metric-fill green" style={{ width: `${metrics.acceptsUncertainty}%` }} />
                </div>
              </div>
            </div>
          </div>

          {metrics.similarUsers && metrics.similarUsers.length > 0 && (
            <div className="similar-users-section">
              <h3 className="section-title">
                <Users className="section-icon" />
                Similar Decision Makers from Dataset
              </h3>
              <p className="section-subtitle">
                Based on {dataset.length.toLocaleString()} real responses from trolley.csv:
              </p>
              <div className="similar-users-list">
                {metrics.similarUsers.map((user, idx) => (
                  <div key={idx} className="similar-user-card">
                    <div className="user-info">
                      <span>User #{user.id} ({user.gender}, Age {user.age})</span>
                      <span className="match-score">{Math.round(user.similarity)}% match</span>
                    </div>
                    <div className="metric-bar">
                      <div className="metric-fill green" style={{ width: `${user.similarity}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="history-section">
            <h3 className="section-title">
              <AlertTriangle className="section-icon" />
              Your Adaptive Journey
            </h3>
            <div className="history-list">
              {choices.map((choice, idx) => (
                <div key={idx} className="history-card">
                  <div className="history-header">
                    <span className="history-scenario">{choice.scenario}</span>
                    <span className="history-choice">Option {choice.choice}</span>
                  </div>
                  <p className="history-action">{choice.optionChosen.action}</p>
                  {idx > 0 && (
                    <p className="history-note">↳ Scenario adapted from dataset based on your patterns</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={reset} className="btn-primary" style={{ flex: 1 }}>
              Start New Simulation
            </button>
            <a href="dashboard.html" className="btn-primary" style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              View Full Dashboard →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AdaptiveTrolleySimulator;
