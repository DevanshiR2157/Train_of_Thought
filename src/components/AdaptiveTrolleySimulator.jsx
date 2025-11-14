// AdaptiveTrolleySimulator.jsx
// Place this file in: src/components/AdaptiveTrolleySimulator.jsx

import React, { useState } from 'react';
import { Brain, TrendingUp, Users, Scale, Heart, AlertTriangle, Upload } from 'lucide-react';
import './AdaptiveTrolleySimulator.css';

const AdaptiveTrolleySimulator = () => {
  const [stage, setStage] = useState('upload');
  const [datasetLoaded, setDatasetLoaded] = useState(false);
  const [dataset, setDataset] = useState([]);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [choices, setChoices] = useState([]);
  const [scenarioCount, setScenarioCount] = useState(0);
  const totalScenarios = 7;

  // Predefined scenario templates based on common trolley problem variations
  const scenarioTemplates = [
    {
      id: 'classic',
      title: 'The Classic Trolley',
      generateContext: (params) => `A runaway trolley is heading toward ${params.mainTrackCount} ${params.mainTrackAge} on the tracks. You can pull a lever to divert it to a side track where ${params.sideTrackCount} ${params.sideTrackAge} ${params.sideTrackRelation}.`,
      dimensions: ['lives', 'age', 'action']
    },
    {
      id: 'bridge',
      title: 'The Bridge Dilemma',
      generateContext: (params) => `You're on a bridge above trolley tracks. A runaway trolley is heading toward ${params.victimCount} people. The only way to stop it is to push a ${params.bystanderAge} ${params.bystanderRelation} off the bridge, which would stop the trolley but kill them.`,
      dimensions: ['lives', 'personal_harm', 'relationship']
    },
    {
      id: 'loop',
      title: 'The Loop Track',
      generateContext: (params) => `A trolley is heading toward ${params.mainCount} people. You can divert it to a loop track where it will hit ${params.loopCount} ${params.loopAge}, but there's only a ${params.certainty}% chance the loop will work properly.`,
      dimensions: ['lives', 'certainty', 'age']
    },
    {
      id: 'fat_man',
      title: 'The Large Person',
      generateContext: (params) => `${params.victimCount} people are on the tracks. You could push a large person in front of the trolley to stop it (killing them but saving the others), or do nothing.`,
      dimensions: ['lives', 'personal_harm', 'direct_action']
    },
    {
      id: 'transplant',
      title: 'The Medical Decision',
      generateContext: (params) => `You're a doctor with ${params.patientCount} patients who need organ transplants. A ${params.donorAge} ${params.donorRelation} comes in for a routine checkup. Their organs could save all ${params.patientCount} patients.`,
      dimensions: ['lives', 'professional_ethics', 'age']
    },
    {
      id: 'species',
      title: 'The Animal Consideration',
      generateContext: (params) => `A trolley is heading toward ${params.humanCount} ${params.humanAge}. You can divert it to a track with ${params.animalCount} ${params.animalType}. Both tracks lead to certain death.`,
      dimensions: ['species', 'lives', 'age']
    },
    {
      id: 'probability',
      title: 'The Uncertain Outcome',
      generateContext: (params) => `You can take action that has a ${params.successRate}% chance of saving ${params.majorityCount} people but will definitely kill ${params.sacrificeCount} ${params.sacrificeAge}, or do nothing and ${params.certainDeathCount} people definitely die.`,
      dimensions: ['certainty', 'lives', 'action']
    }
  ];

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim();
      });
      return row;
    });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const parsedData = parseCSV(text);
        setDataset(parsedData);
        setDatasetLoaded(true);
        console.log(`Loaded ${parsedData.length} records from dataset`);
      };
      reader.readAsText(file);
    }
  };

  const analyzeUserPatterns = () => {
    if (choices.length === 0) return null;

    const patterns = {
      prefersYounger: 0,
      prefersMore: 0,
      avoidsAction: 0,
      prefersKnown: 0,
      acceptsUncertainty: 0,
      utilitarian: 0
    };

    choices.forEach(choice => {
      const chosen = choice.metadata;
      
      if (chosen.prefersYounger) patterns.prefersYounger++;
      if (chosen.prefersMore) patterns.prefersMore++;
      if (chosen.avoidsAction) patterns.avoidsAction++;
      if (chosen.prefersKnown) patterns.prefersKnown++;
      if (chosen.acceptsUncertainty) patterns.acceptsUncertainty++;
      if (chosen.utilitarian) patterns.utilitarian++;
    });

    return patterns;
  };

  const findSimilarUsersFromDataset = () => {
    if (choices.length === 0 || dataset.length === 0) return [];

    const userPattern = choices.map(c => c.choice === 'A' ? 1 : 0);
    
    const similarities = dataset.slice(0, 100).map(user => {
      let matchCount = 0;
      userPattern.forEach((choice, idx) => {
        const responseKey = `response${idx + 1}`;
        if (user[responseKey] && parseInt(user[responseKey]) === choice) {
          matchCount++;
        }
      });
      
      return {
        id: user.ResponseId || user.id,
        gender: user.gender || 'Unknown',
        age: user.age || 'Unknown',
        similarity: (matchCount / userPattern.length) * 100
      };
    });

    return similarities
      .filter(s => s.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  };

  const generateAdaptiveScenario = () => {
    const patterns = analyzeUserPatterns();
    
    let template;
    
    if (scenarioCount === 0) {
      template = scenarioTemplates[0];
    } else if (patterns) {
      if (patterns.prefersYounger > choices.length * 0.6) {
        template = scenarioTemplates[2];
      } else if (patterns.prefersMore > choices.length * 0.6) {
        template = scenarioTemplates[4];
      } else if (patterns.avoidsAction > choices.length * 0.5) {
        template = scenarioTemplates[6];
      } else {
        template = scenarioTemplates[Math.floor(Math.random() * scenarioTemplates.length)];
      }
    } else {
      template = scenarioTemplates[scenarioCount % scenarioTemplates.length];
    }

    const params = generateScenarioParams(patterns);
    
    const scenario = {
      title: template.title,
      context: template.generateContext(params),
      optionA: generateOption('A', template, params, patterns),
      optionB: generateOption('B', template, params, patterns)
    };

    return scenario;
  };

  const generateScenarioParams = (patterns) => {
    const ages = ['children (8-12)', 'teenagers (13-17)', 'young adults (25-35)', 'middle-aged adults (40-55)', 'elderly people (65+)'];
    const relations = ['who are strangers', 'who are coworkers', 'including a family member', 'who are friends'];
    
    return {
      mainTrackCount: Math.floor(Math.random() * 4) + 3,
      sideTrackCount: Math.floor(Math.random() * 2) + 1,
      mainTrackAge: ages[Math.floor(Math.random() * ages.length)],
      sideTrackAge: ages[Math.floor(Math.random() * ages.length)],
      sideTrackRelation: relations[Math.floor(Math.random() * relations.length)],
      victimCount: Math.floor(Math.random() * 4) + 3,
      bystanderAge: ages[Math.floor(Math.random() * ages.length)].replace(/\(.*?\)/g, '').trim(),
      bystanderRelation: relations[Math.floor(Math.random() * relations.length)],
      mainCount: Math.floor(Math.random() * 4) + 4,
      loopCount: Math.floor(Math.random() * 2) + 1,
      loopAge: ages[Math.floor(Math.random() * ages.length)],
      certainty: Math.floor(Math.random() * 30) + 60,
      patientCount: Math.floor(Math.random() * 3) + 3,
      donorAge: ages[2],
      donorRelation: 'healthy person',
      humanCount: Math.floor(Math.random() * 2) + 1,
      humanAge: ages[Math.floor(Math.random() * ages.length)],
      animalCount: Math.floor(Math.random() * 10) + 10,
      animalType: ['dogs', 'cats', 'horses', 'endangered gorillas'][Math.floor(Math.random() * 4)],
      successRate: Math.floor(Math.random() * 40) + 50,
      majorityCount: Math.floor(Math.random() * 5) + 5,
      sacrificeCount: Math.floor(Math.random() * 2) + 1,
      sacrificeAge: ages[Math.floor(Math.random() * ages.length)],
      certainDeathCount: Math.floor(Math.random() * 3) + 3
    };
  };

  const generateOption = (option, template, params, patterns) => {
    const actions = option === 'A' 
      ? ['Pull the lever', 'Take action', 'Intervene', 'Make the active choice', 'Divert the trolley']
      : ['Do nothing', 'Let events unfold naturally', 'Avoid intervention', 'Maintain the status quo', 'Not pull the lever'];
    
    const consequences = option === 'A'
      ? [`${params.sideTrackCount} people die, but ${params.mainTrackCount} are saved`]
      : [`${params.mainTrackCount} people die, but you didn't actively cause anyone's death`];

    const metadata = {
      lives: option === 'A' ? params.sideTrackCount : params.mainTrackCount,
      prefersYounger: false,
      prefersMore: option === 'A' ? params.mainTrackCount > params.sideTrackCount : false,
      avoidsAction: option === 'B',
      prefersKnown: false,
      acceptsUncertainty: params.certainty < 100,
      utilitarian: option === 'A' ? params.mainTrackCount > params.sideTrackCount : false
    };

    return {
      action: actions[Math.floor(Math.random() * actions.length)],
      consequence: consequences[0],
      metadata: metadata
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
    setStage(datasetLoaded ? 'ready' : 'upload');
    setCurrentScenario(null);
    setChoices([]);
    setScenarioCount(0);
  };

  // Render functions for each stage
  if (stage === 'upload') {
    return (
      <div className="simulator-container">
        <div className="simulator-card">
          <div className="text-center mb-8">
            <Brain className="icon-large mx-auto mb-4" />
            <h1 className="title">Dataset-Based Trolley Problem</h1>
            <p className="subtitle">
              Upload your trolley.csv dataset to enable adaptive moral dilemmas based on real responses.
            </p>
          </div>

          <div className="feature-list mb-8">
            <div className="feature-item">
              <Upload className="feature-icon" />
              <p>Upload trolley.csv (5000+ responses) to compare your choices</p>
            </div>
            <div className="feature-item">
              <TrendingUp className="feature-icon" />
              <p>Questions adapt based on your patterns and challenge your biases</p>
            </div>
            <div className="feature-item">
              <AlertTriangle className="feature-icon" />
              <p>No API key needed - everything runs locally in your browser</p>
            </div>
          </div>

          <div className="upload-area mb-6">
            <label className="upload-label">
              <div className="upload-box">
                <Upload className="upload-icon" />
                <p className="upload-title">Click to upload trolley.csv</p>
                <p className="upload-subtitle">or drag and drop your dataset file here</p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="upload-input"
              />
            </label>
          </div>

          {datasetLoaded && (
            <div className="success-message mb-6">
              <span className="checkmark">✓</span>
              Dataset loaded successfully! {dataset.length} responses available.
            </div>
          )}

          {datasetLoaded && (
            <button onClick={startSimulation} className="btn-primary">
              Begin Adaptive Simulation
            </button>
          )}
        </div>
      </div>
    );
  }

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
                <p className="notice-title">Adaptive Challenge</p>
                <p className="notice-text">
                  This scenario was generated based on your previous {choices.length} choice{choices.length > 1 ? 's' : ''} to test your moral consistency.
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

  if (stage === 'results') {
    const metrics = calculateMetrics();

    return (
      <div className="simulator-container">
        <div className="results-wrapper">
          <div className="results-header">
            <Scale className="icon-large mx-auto mb-4" />
            <h1 className="title">Your Moral Profile</h1>
            <p className="subtitle">Based on {choices.length} adaptive scenarios from our dataset</p>
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
                Based on {dataset.length} responses, here are users with similar patterns:
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
                    <p className="history-note">↳ Adapted to challenge your previous patterns</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button onClick={reset} className="btn-primary">
            Start New Simulation
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AdaptiveTrolleySimulator;
