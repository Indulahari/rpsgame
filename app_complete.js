// Modern Rock Paper Scissors Game
// Complete implementation with all requested features

// Constants
const CHOICES = ['rock', 'paper', 'scissors'];
const CHOICE_EMOJIS = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️'
};
const WINNING_COMBINATIONS = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper'
};

const AVATAR_FACES = {
  neutral: { player: '😐', computer: '🤖' },
  happy: { player: '😄', computer: '😊' },
  sad: { player: '😢', computer: '😔' }
};

// Game state
let state = {
  mode: 'normal', // 'normal', 'timed', 'challenge', 'tournament'
  timer: 3,
  timerInterval: null,
  streak: 0,
  longestStreak: 0,
  totalGames: 0,
  wins: 0,
  playerChoice: null,
  computerChoice: null,
  result: null,
  muted: false,
  musicPlaying: false,
  theme: 'light',
  isPlaying: false,
  gameHistory: [],
  // New features
  powerUps: {
    shield: 0, // Protects from one loss
    doubleWin: 0, // Next win counts as 2
    peek: 0, // See computer's choice before deciding
    timeFreeze: 0 // Pause timer for 5 seconds
  },
  challengeMode: {
    active: false,
    target: 5,
    current: 0,
    timeLimit: 60,
    timeLeft: 60
  },
  tournament: {
    active: false,
    round: 1,
    maxRounds: 5,
    wins: 0,
    losses: 0
  },
  dailyChallenge: {
    completed: false,
    date: null,
    target: 3,
    progress: 0
  },
  playerLevel: 1,
  experience: 0,
  experienceToNext: 100
};

// DOM elements cache
let elements = {};

// Simplified Sound Manager
const soundManager = {
  audioContext: null,
  isInitialized: false,
  masterGain: null,
  backgroundMusic: [],
  musicInterval: null,
  speechSynth: window.speechSynthesis,
  
  async init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.7;
      this.isInitialized = true;
      console.log('🔊 Enhanced sound system initialized');
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  },
  
  async ensureContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('🎵 Audio context resumed successfully');
      } catch (error) {
        console.error('Failed to resume audio context:', error);
      }
    }
  },
  
  async playMoveSound(choice) {
    if (state.muted || !this.isInitialized) return;
    await this.ensureContext();
    
    const configs = {
      rock: { freqs: [60, 80, 120], type: 'sawtooth', duration: 0.2 },
      paper: { freqs: [300, 600, 900], type: 'sine', duration: 0.15 },
      scissors: { freqs: [600, 1200, 1800], type: 'square', duration: 0.1 }
    };
    
    this.playTone(configs[choice]);
  },
  
  async playResultSound(result) {
    if (state.muted || !this.isInitialized) return;
    await this.ensureContext();
    
    const sounds = {
      win: () => this.playChord([523, 659, 784]),
      lose: () => this.playDescending([200, 150, 100]),
      draw: () => this.playTone({ freqs: [400], type: 'sine', duration: 0.1 })
    };
    
    sounds[result]?.();
  },
  
  playTone(config) {
    const now = this.audioContext.currentTime;
    config.freqs.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.frequency.value = freq;
      osc.type = config.type;
      
      const vol = 0.3 / (i + 1);
      const delay = i * 0.02;
      
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(vol, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + config.duration);
      
      osc.start(now + delay);
      osc.stop(now + delay + config.duration);
    });
  },
  
  playChord(frequencies) {
    frequencies.forEach((freq, i) => {
      setTimeout(() => this.playTone({ freqs: [freq], type: 'sine', duration: 0.3 }), i * 100);
    });
  },
  
  playDescending(frequencies) {
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.frequency.setValueAtTime(frequencies[0], now);
    osc.frequency.exponentialRampToValueAtTime(frequencies[2], now + 0.5);
    osc.type = 'sawtooth';
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc.start(now);
    osc.stop(now + 0.5);
  },
  
  announceResult(result, playerChoice, computerChoice) {
    if (state.muted || !this.speechSynth) return;
    
    const messages = {
      win: `You win! ${playerChoice} beats ${computerChoice}`,
      lose: `You lose! ${computerChoice} beats ${playerChoice}`,
      draw: `It's a draw! Both chose ${playerChoice}`
    };
    
    const utterance = new SpeechSynthesisUtterance(messages[result]);
    utterance.rate = 1.2;
    utterance.pitch = result === 'win' ? 1.2 : result === 'lose' ? 0.8 : 1;
    this.speechSynth.speak(utterance);
  },
  
  async toggleBackgroundMusic() {
    try {
      await this.ensureContext();
      
      state.musicPlaying = !state.musicPlaying;
      saveState();
      
      if (state.musicPlaying) {
        console.log('🎵 Starting background music...');
        await this.playBackgroundMusic();
      } else {
        console.log('🎵 Stopping background music...');
        this.stopBackgroundMusic();
      }
    } catch (error) {
      console.error('Failed to toggle music:', error);
      state.musicPlaying = false;
      saveState();
    }
  },
  
  async playBackgroundMusic() {
    if (!this.audioContext || state.muted || !state.musicPlaying) return;
    
    await this.ensureContext();
    
    // Stop any existing music
    this.stopBackgroundMusic();
    
    let beatCount = 0;
    
    // Elegant piano and drums music
    const playElegantMusic = () => {
      if (!state.musicPlaying) return;
      
      try {
        // Shape of You melody and chords
        const shapeOfYouMelody = [
          // Main melody line from "Shape of You"
          [523.25, 587.33, 659.25, 523.25], // C-D-E-C
          [587.33, 659.25, 698.46, 659.25], // D-E-F-E  
          [523.25, 587.33, 659.25, 698.46], // C-D-E-F
          [659.25, 587.33, 523.25, 440.00]  // E-D-C-A
        ];
        
        // Shape of You chord progression (C#m - F#m - A - B)
        // Transposed to C minor for easier frequencies
        const shapeOfYouChords = [
          [523.25, 622.25, 783.99], // Cm (C-Eb-G)
          [698.46, 830.61, 1046.50], // Fm (F-Ab-C)
          [440.00, 554.37, 659.25], // Am (A-C#-E) 
          [493.88, 622.25, 739.99]  // Bb (Bb-D-F)
        ];
        
        const currentMelody = shapeOfYouMelody[beatCount % shapeOfYouMelody.length];
        const currentChord = shapeOfYouChords[beatCount % shapeOfYouChords.length];
        
        // Play Shape of You melody
        currentMelody.forEach((freq, index) => {
          const melody = this.audioContext.createOscillator();
          const melodyGain = this.audioContext.createGain();
          const melodyFilter = this.audioContext.createBiquadFilter();
          
          melody.frequency.value = freq;
          melody.type = 'sawtooth'; // Bright, catchy sound
          
          // Bright filter for pop sound
          melodyFilter.type = 'lowpass';
          melodyFilter.frequency.value = 3000;
          melodyFilter.Q.value = 1;
          
          const startTime = this.audioContext.currentTime + (index * 0.25); // Quarter note timing
          const duration = 0.4;
          
          // Pop melody envelope
          melodyGain.gain.setValueAtTime(0, startTime);
          melodyGain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
          melodyGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          
          melody.connect(melodyFilter);
          melodyFilter.connect(melodyGain);
          melodyGain.connect(this.audioContext.destination);
          
          melody.start(startTime);
          melody.stop(startTime + duration);
          
          this.backgroundMusic.push(melody);
        });
        
        // Play Shape of You chords
        currentChord.forEach((freq, index) => {
          const chord = this.audioContext.createOscillator();
          const chordGain = this.audioContext.createGain();
          const chordFilter = this.audioContext.createBiquadFilter();
          
          chord.frequency.value = freq;
          chord.type = 'triangle';
          
          // Warm chord filter
          chordFilter.type = 'lowpass';
          chordFilter.frequency.value = 1500;
          chordFilter.Q.value = 0.7;
          
          const startTime = this.audioContext.currentTime + (index * 0.03);
          const duration = 1.8;
          
          // Chord envelope
          chordGain.gain.setValueAtTime(0, startTime);
          chordGain.gain.linearRampToValueAtTime(0.06, startTime + 0.05);
          chordGain.gain.exponentialRampToValueAtTime(0.02, startTime + 0.5);
          chordGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          
          chord.connect(chordFilter);
          chordFilter.connect(chordGain);
          chordGain.connect(this.audioContext.destination);
          
          chord.start(startTime);
          chord.stop(startTime + duration);
          
          this.backgroundMusic.push(chord);
        });
        
        // Elegant drum pattern
        const drumPattern = [
          { type: 'kick', time: 0 },
          { type: 'hihat', time: 0.25 },
          { type: 'snare', time: 0.5 },
          { type: 'hihat', time: 0.75 },
          { type: 'kick', time: 1.0 },
          { type: 'hihat', time: 1.25 },
          { type: 'snare', time: 1.5 },
          { type: 'hihat', time: 1.75 }
        ];
        
        drumPattern.forEach(drum => {
          const startTime = this.audioContext.currentTime + drum.time;
          
          if (drum.type === 'kick') {
            // Kick drum - low frequency thump
            const kick = this.audioContext.createOscillator();
            const kickGain = this.audioContext.createGain();
            const kickFilter = this.audioContext.createBiquadFilter();
            
            kick.frequency.setValueAtTime(60, startTime);
            kick.frequency.exponentialRampToValueAtTime(30, startTime + 0.1);
            kick.type = 'sine';
            
            kickFilter.type = 'lowpass';
            kickFilter.frequency.value = 100;
            
            kickGain.gain.setValueAtTime(0, startTime);
            kickGain.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
            kickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
            
            kick.connect(kickFilter);
            kickFilter.connect(kickGain);
            kickGain.connect(this.audioContext.destination);
            
            kick.start(startTime);
            kick.stop(startTime + 0.3);
            
            this.backgroundMusic.push(kick);
            
          } else if (drum.type === 'snare') {
            // Snare drum - noise burst with tone
            const snare = this.audioContext.createOscillator();
            const snareGain = this.audioContext.createGain();
            const snareFilter = this.audioContext.createBiquadFilter();
            
            snare.frequency.value = 200;
            snare.type = 'square';
            
            snareFilter.type = 'bandpass';
            snareFilter.frequency.value = 400;
            snareFilter.Q.value = 2;
            
            snareGain.gain.setValueAtTime(0, startTime);
            snareGain.gain.linearRampToValueAtTime(0.08, startTime + 0.005);
            snareGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
            
            snare.connect(snareFilter);
            snareFilter.connect(snareGain);
            snareGain.connect(this.audioContext.destination);
            
            snare.start(startTime);
            snare.stop(startTime + 0.15);
            
            this.backgroundMusic.push(snare);
            
          } else if (drum.type === 'hihat') {
            // Hi-hat - high frequency noise
            const hihat = this.audioContext.createOscillator();
            const hihatGain = this.audioContext.createGain();
            const hihatFilter = this.audioContext.createBiquadFilter();
            
            hihat.frequency.value = 8000 + (Math.random() * 2000);
            hihat.type = 'square';
            
            hihatFilter.type = 'highpass';
            hihatFilter.frequency.value = 6000;
            
            hihatGain.gain.setValueAtTime(0, startTime);
            hihatGain.gain.linearRampToValueAtTime(0.03, startTime + 0.001);
            hihatGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);
            
            hihat.connect(hihatFilter);
            hihatFilter.connect(hihatGain);
            hihatGain.connect(this.audioContext.destination);
            
            hihat.start(startTime);
            hihat.stop(startTime + 0.08);
            
            this.backgroundMusic.push(hihat);
          }
        });
        
        // Shape of You bass line
        const shapeOfYouBass = [130.81, 174.61, 220.00, 246.94]; // C3, F3, A3, B3
        const bassNote = shapeOfYouBass[beatCount % shapeOfYouBass.length];
        
        const bass = this.audioContext.createOscillator();
        const bassGain = this.audioContext.createGain();
        const bassFilter = this.audioContext.createBiquadFilter();
        
        bass.frequency.value = bassNote;
        bass.type = 'sine';
        
        bassFilter.type = 'lowpass';
        bassFilter.frequency.value = 200;
        
        bassGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        bassGain.gain.linearRampToValueAtTime(0.06, this.audioContext.currentTime + 0.05);
        bassGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.5);
        
        bass.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.audioContext.destination);
        
        bass.start();
        bass.stop(this.audioContext.currentTime + 1.5);
        
        this.backgroundMusic.push(bass);
        
        beatCount++;
        console.log(`🎵 Shape of You - Beat: ${beatCount}`);
      } catch (error) {
        console.error('Music playback error:', error);
      }
    };
    
    // Play music every 2 seconds (120 BPM)
    playElegantMusic();
    this.musicInterval = setInterval(() => {
      if (state.musicPlaying) {
        playElegantMusic();
      } else {
        clearInterval(this.musicInterval);
      }
    }, 2000);
  },
  
  stopBackgroundMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    
    if (this.backgroundMusic && this.backgroundMusic.length > 0) {
      this.backgroundMusic.forEach(osc => {
        try { 
          if (osc && osc.stop) {
            osc.stop(); 
          }
        } catch(e) {
          console.log('Oscillator already stopped');
        }
      });
      this.backgroundMusic = [];
    }
    
    console.log('🎵 Background music stopped');
  },
  
  playComboSound(level) {
    if (state.muted || !this.isInitialized) return;
    
    const frequencies = {
      3: [523, 659, 784], // C major chord
      5: [523, 659, 784, 1047], // C major with octave
      10: [523, 659, 784, 1047, 1319] // Extended chord
    };
    
    const freqs = frequencies[level] || frequencies[3];
    const now = this.audioContext.currentTime;
    
    freqs.forEach((freq, index) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      
      osc.frequency.value = freq;
      osc.type = 'sine';
      filter.type = 'lowpass';
      filter.frequency.value = freq * 2;
      
      const startTime = now + index * 0.1;
      const duration = 0.5;
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }
};

// Visual Effects Manager
const visualEffects = {
  triggerBackgroundEffect(result) {
    const bg = document.querySelector('.background-gradient');
    bg.classList.remove('bg-effect-win', 'bg-effect-lose', 'bg-effect-draw');
    bg.classList.add(`bg-effect-${result}`);
    setTimeout(() => bg.classList.remove(`bg-effect-${result}`), 1000);
  },
  
  updateAvatars(result) {
    const playerAvatar = elements.playerAvatar;
    const computerAvatar = elements.computerAvatar;
    
    playerAvatar.className = `avatar avatar--${result === 'win' ? 'happy' : result === 'lose' ? 'sad' : 'neutral'}`;
    computerAvatar.className = `avatar avatar--${result === 'lose' ? 'happy' : result === 'win' ? 'sad' : 'neutral'}`;
    
    const playerFace = playerAvatar.querySelector('.avatar__face');
    const computerFace = computerAvatar.querySelector('.avatar__face');
    
    playerFace.textContent = AVATAR_FACES[result === 'win' ? 'happy' : result === 'lose' ? 'sad' : 'neutral'].player;
    computerFace.textContent = AVATAR_FACES[result === 'lose' ? 'happy' : result === 'win' ? 'sad' : 'neutral'].computer;
  },
  
  shakeScreenOnLoss() {
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 500);
  },
  
  fireConfetti() {
    const container = elements.confettiContainer;
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
      confetti.style.animationDelay = Math.random() * 0.5 + 's';
      container.appendChild(confetti);
      
      setTimeout(() => confetti.remove(), 3000);
    }
  },
  
  pulseButton(button) {
    button.classList.add('pulse');
    setTimeout(() => button.classList.remove('pulse'), 600);
  }
};

// Timer Manager
const timerManager = {
  start() {
    if (state.mode !== 'timed') return;
    
    state.timer = 3;
    this.updateDisplay();
    elements.timerContainer.classList.remove('hidden');
    
    state.timerInterval = setInterval(() => {
      state.timer--;
      this.updateDisplay();
      
      if (state.timer <= 0) {
        this.timeout();
      }
    }, 1000);
  },
  
  stop() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    elements.timerContainer.classList.add('hidden');
  },
  
  updateDisplay() {
    elements.timerDisplay.textContent = state.timer;
    elements.timerProgress.style.width = (state.timer / 3) * 100 + '%';
  },
  
  timeout() {
    this.stop();
    // Auto-lose on timeout
    const computerChoice = getComputerChoice();
    playRound(null, computerChoice, true);
  }
};

// Game functions
function getComputerChoice() {
  return CHOICES[Math.floor(Math.random() * CHOICES.length)];
}

function getRoundResult(playerChoice, computerChoice) {
  if (playerChoice === computerChoice) return 'draw';
  return WINNING_COMBINATIONS[playerChoice] === computerChoice ? 'win' : 'lose';
}

// Main game play function
async function playRound(playerChoice, computerChoice = null, isTimeout = false) {
  if (state.isPlaying && !isTimeout) return;
  
  state.isPlaying = true;
  timerManager.stop();
  
  // Handle timeout case
  if (isTimeout) {
    playerChoice = null;
    state.result = 'lose';
  } else {
    computerChoice = getComputerChoice();
    state.result = getRoundResult(playerChoice, computerChoice);
  }
  
  state.playerChoice = playerChoice;
  state.computerChoice = computerChoice;
  
  // Disable buttons
  document.querySelectorAll('.choice-btn').forEach(btn => btn.disabled = true);
  
  // Play move sound
  if (playerChoice) {
    await soundManager.playMoveSound(playerChoice);
  }
  
  // Animate choice reveal
  await animateChoiceReveal();
  
  // Update game state
  updateGameState();
  
  // Visual and audio feedback
  visualEffects.triggerBackgroundEffect(state.result);
  visualEffects.updateAvatars(state.result);
  
  if (state.result === 'lose') {
    visualEffects.shakeScreenOnLoss();
  }
  
  // Play result sound and announce
  await soundManager.playResultSound(state.result);
  soundManager.announceResult(state.result, playerChoice || 'nothing', computerChoice);
  
  // Show confetti and combo effects for streaks
  if (state.result === 'win' && state.streak >= 3) {
    visualEffects.fireConfetti();
    comboSystem.checkComboMilestones(state.streak);
  }
  
  // Update UI and displays
  renderUI();
  levelSystem.updateDisplay();
  powerUpSystem.updatePowerUpDisplay();
  
  // Re-enable buttons and start new timer
  setTimeout(() => {
    document.querySelectorAll('.choice-btn').forEach(btn => btn.disabled = false);
    state.isPlaying = false;
    timerManager.start();
  }, 2000);
}

async function animateChoiceReveal() {
  const playerCard = elements.playerChoice.querySelector('.choice-card');
  const computerCard = elements.computerChoice.querySelector('.choice-card');
  
  // Update card backs with choices
  const playerBack = playerCard.querySelector('.choice-card__back');
  const computerBack = computerCard.querySelector('.choice-card__back');
  
  playerBack.textContent = state.playerChoice ? CHOICE_EMOJIS[state.playerChoice] : '⏰';
  computerBack.textContent = CHOICE_EMOJIS[state.computerChoice];
  
  // Animate flip
  playerCard.classList.add('flipped');
  computerCard.classList.add('flipped');
  
  await new Promise(resolve => setTimeout(resolve, 600));
  
  // Reset after delay
  setTimeout(() => {
    playerCard.classList.remove('flipped');
    computerCard.classList.remove('flipped');
  }, 2000);
}

function updateGameState() {
  state.totalGames++;
  
  let actualResult = state.result;
  
  // Handle power-ups
  if (state.result === 'lose' && state.shieldActive) {
    actualResult = 'draw'; // Shield blocks the loss
    state.shieldActive = false;
    showNotification('🛡️ Shield blocked the loss!');
  }
  
  if (actualResult === 'win') {
    state.wins++;
    
    // Handle double win power-up
    if (state.doubleWinActive) {
      state.wins++; // Count as 2 wins
      state.doubleWinActive = false;
      showNotification('⚡ Double Win! This counts as 2 wins!');
    }
    
    state.streak++;
    if (state.streak > state.longestStreak) {
      state.longestStreak = state.streak;
    }
    
    // Add experience for wins
    levelSystem.addExperience(10 + (state.streak * 2));
    
    // Check daily challenge
    dailyChallengeSystem.onWin();
    
    // Check challenge mode
    challengeManager.onWin();
    
    // Grant power-up occasionally
    if (Math.random() < 0.1) { // 10% chance
      powerUpSystem.grantRandomPowerUp();
    }
    
  } else if (actualResult === 'lose') {
    // Lose: decrease streak by 1 (minimum 0)
    state.streak = Math.max(0, state.streak - 1);
    
    // Small XP for participation
    levelSystem.addExperience(1);
  } else {
    // Draw: small XP
    levelSystem.addExperience(3);
  }
  
  // Tournament mode handling
  tournamentManager.onGameEnd(actualResult);
  
  // Add to history
  state.gameHistory.unshift({
    playerChoice: state.playerChoice,
    computerChoice: state.computerChoice,
    result: actualResult,
    timestamp: Date.now()
  });
  
  // Keep only last 10 games
  if (state.gameHistory.length > 10) {
    state.gameHistory = state.gameHistory.slice(0, 10);
  }
  
  state.lastResult = actualResult;
  saveState();
}

function renderUI() {
  // Update result text
  const resultMessages = {
    win: `🎉 You Win! ${state.playerChoice} beats ${state.computerChoice}`,
    lose: state.playerChoice ? `😔 You Lose! ${state.computerChoice} beats ${state.playerChoice}` : '⏰ Time\'s Up! You Lose!',
    draw: `🤝 It's a Draw! Both chose ${state.playerChoice}`
  };
  
  elements.resultText.textContent = resultMessages[state.result] || 'Choose your move!';
  
  // Update result panel styling
  elements.resultPanel.className = `result-panel ${state.result ? `result-panel--${state.result}` : ''}`;
  
  // Update stats
  elements.totalGames.textContent = state.totalGames;
  elements.winPercentage.textContent = state.totalGames > 0 ? Math.round((state.wins / state.totalGames) * 100) + '%' : '0%';
  elements.longestStreak.textContent = state.longestStreak;
  elements.currentStreak.textContent = state.streak;
  
  // Update streak progress (max 10 for visual purposes)
  const progressPercent = Math.min((state.streak / 10) * 100, 100);
  elements.streakProgress.style.width = progressPercent + '%';
}

// Theme management
function toggleTheme() {
  const themes = ['light', 'dark', 'neon'];
  const currentIndex = themes.indexOf(state.theme);
  const nextIndex = (currentIndex + 1) % themes.length;
  state.theme = themes[nextIndex];
  
  document.body.setAttribute('data-theme', state.theme);
  
  const themeLabels = { light: '☀️ Light', dark: '🌙 Dark', neon: '⚡ Neon' };
  elements.themeText.textContent = themeLabels[state.theme];
  
  saveState();
}

function toggleMode() {
  const modes = ['normal', 'timed', 'challenge', 'tournament'];
  const currentIndex = modes.indexOf(state.mode);
  const nextIndex = (currentIndex + 1) % modes.length;
  state.mode = modes[nextIndex];
  
  const modeLabels = {
    normal: 'Normal Mode',
    timed: 'Timed Mode', 
    challenge: 'Challenge Mode',
    tournament: 'Tournament Mode'
  };
  
  const modeDescriptions = {
    normal: 'Classic Rock Paper Scissors',
    timed: '3 seconds per move',
    challenge: 'Get 5 wins in 60 seconds',
    tournament: 'Best of 5 rounds'
  };
  
  elements.modeText.textContent = modeLabels[state.mode];
  
  // Update mode display
  if (elements.modeInfo) {
    elements.modeInfo.textContent = modeLabels[state.mode];
  }
  if (elements.modeDescription) {
    elements.modeDescription.textContent = modeDescriptions[state.mode];
  }
  
  // Reset any active special modes
  challengeManager.stop();
  tournamentManager.stop();
  timerManager.stop();
  
  // Start appropriate mode
  if (state.mode === 'timed') {
    timerManager.start();
  } else if (state.mode === 'challenge') {
    challengeManager.start();
  } else if (state.mode === 'tournament') {
    tournamentManager.start();
  }
  
  saveState();
}

function toggleMute() {
  state.muted = !state.muted;
  elements.muteText.textContent = state.muted ? '🔇 Muted' : '🔊 Sound';
  saveState();
}

function resetGame() {
  state.streak = 0;
  state.totalGames = 0;
  state.wins = 0;
  state.gameHistory = [];
  state.playerChoice = null;
  state.computerChoice = null;
  state.result = null;
  
  // Reset achievement badges
  achievementSystem.resetBadges();
  
  timerManager.stop();
  renderUI();
  saveState();
  
  // Reset avatars
  visualEffects.updateAvatars('neutral');
}

// Share functionality
async function shareResult() {
  const gameUrl = window.location.href;
  const shareText = `🎮 Play Rock Paper Scissors with me!\n\n🔗 Game Link: ${gameUrl}\n\n📊 My Current Stats:\n• Games Played: ${state.totalGames}\n• Current Streak: ${state.streak}\n• Best Streak: ${state.longestStreak}\n• Win Rate: ${state.totalGames > 0 ? Math.round((state.wins / state.totalGames) * 100) : 0}%\n\n${state.lastResult ? `Last Game: ${state.lastResult === 'win' ? '🎉 Won!' : state.lastResult === 'lose' ? '😔 Lost!' : '🤝 Draw!'}` : 'Challenge me to a game!'}\n\nClick the link to play! 🎯`;
  
  try {
    // Try Web Share API first
    if (navigator.share) {
      await navigator.share({
        title: 'Rock Paper Scissors Game - Challenge Me!',
        text: shareText,
        url: gameUrl
      });
      showNotification('Game link shared successfully! 🎉');
      return;
    }
    
    // Fallback to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareText);
      showNotification('Game link copied to clipboard! 📋');
      return;
    }
    
    // Final fallback - create temporary textarea
    const textArea = document.createElement('textarea');
    textArea.value = shareText;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    if (document.execCommand('copy')) {
      showNotification('Game link copied to clipboard! 📋');
    } else {
      showNotification('Unable to copy. Please copy manually.', 'error');
    }
    
    document.body.removeChild(textArea);
    
  } catch (err) {
    console.error('Share failed:', err);
    showNotification('Share failed. Please try again.', 'error');
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 25px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    max-width: 300px;
    font-size: 14px;
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Animate out and remove
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// State persistence
function saveState() {
  const saveData = {
    theme: state.theme,
    muted: state.muted,
    musicPlaying: state.musicPlaying,
    mode: state.mode,
    longestStreak: state.longestStreak,
    totalGames: state.totalGames,
    wins: state.wins
  };
  
  localStorage.setItem('rps-game-state', JSON.stringify(saveData));
}

function loadState() {
  try {
    const saved = localStorage.getItem('rps-game-state');
    if (saved) {
      const data = JSON.parse(saved);
      Object.assign(state, data);
    }
  } catch (e) {
    console.warn('Failed to load saved state:', e);
  }
}

// Event handlers and initialization
function setupEventListeners() {
  // Choice buttons
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.choice;
      visualEffects.pulseButton(btn);
      playRound(choice);
    });
  });
  
  // Control buttons
  elements.modeToggle.addEventListener('click', toggleMode);
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.musicToggle?.addEventListener('click', async () => {
    try {
      console.log('🎵 Music toggle clicked, current state:', state.musicPlaying);
      await soundManager.toggleBackgroundMusic();
      updateUI();
      console.log('🎵 Music toggle completed, new state:', state.musicPlaying);
    } catch (error) {
      console.error('Music toggle failed:', error);
    }
  });
  elements.muteToggle.addEventListener('click', toggleMute);
  elements.resetBtn.addEventListener('click', resetGame);
  elements.shareBtn.addEventListener('click', shareResult);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (state.isPlaying) return;
    
    const key = e.key.toLowerCase();
    if (key === 'r') playRound('rock');
    else if (key === 'p') playRound('paper');
    else if (key === 's') playRound('scissors');
    else if (key === 'm') toggleMute();
    else if (key === 'backspace') resetGame();
  });
  
  // Enhanced test sound button
  const testSoundBtn = document.createElement('button');
  testSoundBtn.textContent = '🔊 Test Sound';
  testSoundBtn.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 1000;
    padding: 10px 18px;
    background: linear-gradient(45deg, #4CAF50, #45a049);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    transition: all 0.3s ease;
  `;
  
  document.body.appendChild(testSoundBtn);
  
  testSoundBtn.addEventListener('click', async () => {
    try {
      console.log('🔊 Testing sound system...');
      testSoundBtn.textContent = '🎵 Testing...';
      testSoundBtn.style.background = '#FF9800';
      
      await soundManager.ensureContext();
      
      // Play test beep with better sound
      const osc = soundManager.audioContext.createOscillator();
      const gain = soundManager.audioContext.createGain();
      const filter = soundManager.audioContext.createBiquadFilter();
      
      osc.frequency.value = 880; // A5 note
      osc.type = 'triangle';
      
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      
      gain.gain.setValueAtTime(0, soundManager.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, soundManager.audioContext.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, soundManager.audioContext.currentTime + 0.8);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(soundManager.audioContext.destination);
      
      osc.start();
      osc.stop(soundManager.audioContext.currentTime + 0.8);
      
      console.log('🔊 Test sound played successfully');
      testSoundBtn.textContent = '✅ Sound Works!';
      testSoundBtn.style.background = 'linear-gradient(45deg, #2196F3, #1976D2)';
      
      // Start Shape of You music
      setTimeout(async () => {
        try {
          state.musicPlaying = true;
          saveState();
          await soundManager.playBackgroundMusic();
          testSoundBtn.textContent = '🎵 Shape of You!';
          testSoundBtn.style.background = 'linear-gradient(45deg, #E91E63, #9C27B0)';
          
          // Update UI
          if (elements.musicText) {
            elements.musicText.textContent = '🎵 Stop';
          }
          
          console.log('🎵 Shape of You music started!');
        } catch (error) {
          console.error('Failed to start music:', error);
          testSoundBtn.textContent = '❌ Music Failed';
          testSoundBtn.style.background = '#f44336';
        }
      }, 800);
      
      setTimeout(() => {
        if (testSoundBtn.parentNode) {
          testSoundBtn.remove();
        }
      }, 4000);
    } catch (error) {
      console.error('Test sound failed:', error);
      testSoundBtn.textContent = '❌ Sound Failed';
      testSoundBtn.style.background = '#f44336';
    }
  });
  
  // Audio context resume on first interaction
  document.addEventListener('click', () => soundManager.ensureContext(), { once: true });
  document.addEventListener('keydown', () => soundManager.ensureContext(), { once: true });
}

function initializeElements() {
  elements = {
    // Timer elements
    timerContainer: document.getElementById('timer-container'),
    timerDisplay: document.getElementById('timer-display'),
    timerProgress: document.getElementById('timer-progress'),
    
    // Avatar elements
    playerAvatar: document.getElementById('player-avatar'),
    computerAvatar: document.getElementById('computer-avatar'),
    
    // Choice reveal elements
    playerChoice: document.getElementById('player-choice'),
    computerChoice: document.getElementById('computer-choice'),
    
    // Result elements
    resultPanel: document.getElementById('result-panel'),
    resultText: document.getElementById('result-text'),
    
    // Streak elements
    currentStreak: document.getElementById('current-streak'),
    streakProgress: document.getElementById('streak-progress'),
    
    // Stats elements
    totalGames: document.getElementById('total-games'),
    winPercentage: document.getElementById('win-percentage'),
    longestStreak: document.getElementById('longest-streak'),
    
    // Control elements
    modeToggle: document.getElementById('mode-toggle'),
    modeText: document.getElementById('mode-text'),
    themeToggle: document.getElementById('theme-toggle'),
    themeText: document.getElementById('theme-text'),
    musicToggle: document.getElementById('music-toggle'),
    musicText: document.getElementById('music-text'),
    muteToggle: document.getElementById('mute-toggle'),
    muteText: document.getElementById('mute-text'),
    resetBtn: document.getElementById('reset-btn'),
    shareBtn: document.getElementById('share-btn'),
    
    // Achievement elements
    achievementBadges: document.getElementById('achievement-badges'),
    playerLevel: document.getElementById('player-level'),
    currentXp: document.getElementById('current-xp'),
    nextLevelXp: document.getElementById('next-level-xp'),
    xpProgress: document.getElementById('xp-progress'),
    
    // Mode display elements
    modeInfo: document.getElementById('mode-info'),
    modeDescription: document.getElementById('mode-description'),
    
    // Confetti container
    confettiContainer: document.getElementById('confetti-container')
  };
}

// Particle system for background
function createBackgroundParticles() {
  const container = document.getElementById('background-particles');
  
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: absolute;
      width: ${2 + Math.random() * 4}px;
      height: ${2 + Math.random() * 4}px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      left: ${Math.random() * 100}%;
      animation: particleFloat ${8 + Math.random() * 4}s linear infinite;
      animation-delay: ${Math.random() * 8}s;
    `;
    container.appendChild(particle);
  }
}

// Add particle animation CSS
const particleStyle = document.createElement('style');
particleStyle.textContent = `
  @keyframes particleFloat {
    0% {
      transform: translateY(100vh) rotate(0deg);
      opacity: 0;
    }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% {
      transform: translateY(-100px) rotate(360deg);
      opacity: 0;
    }
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(particleStyle);

// Main initialization function
function init() {
  console.log('🎮 Initializing Modern Rock Paper Scissors...');
  
  // Initialize elements
  initializeElements();
  
  // Load saved state
  loadState();
  
  // Apply theme
  document.body.setAttribute('data-theme', state.theme);
  
  // Initialize sound system
  soundManager.init();
  
  // Initialize particle system
  particleSystem.init();
  
  // Create background particles (legacy function)
  createBackgroundParticles();
  
  // Setup event listeners
  setupEventListeners();
  
  // Initial UI render
  renderUI();
  
  // Update control button text
  const themeLabels = { light: '☀️ Light', dark: '🌙 Dark', neon: '⚡ Neon' };
  elements.themeText.textContent = themeLabels[state.theme];
  
  const modeLabels = {
    normal: 'Normal Mode',
    timed: 'Timed Mode', 
    challenge: 'Challenge Mode',
    tournament: 'Tournament Mode'
  };
  elements.modeText.textContent = modeLabels[state.mode];
  
  elements.muteText.textContent = state.muted ? '🔇 Muted' : '🔊 Sound';
  elements.musicText.textContent = state.musicPlaying ? '🎵 Stop' : '🎵 Music';
  
  // Initialize level and achievement displays
  levelSystem.updateDisplay();
  powerUpSystem.updatePowerUpDisplay();
  
  // Start timer if in timed mode
  if (state.mode === 'timed') {
    timerManager.start();
  }
  
  // Start background music automatically on first user interaction
  if (!state.hasOwnProperty('musicPlaying')) {
    state.musicPlaying = true; // Default to music on
  }
  
  // Auto-start music on first user interaction
  const startAudioOnInteraction = async () => {
    try {
      await soundManager.ensureContext();
      
      // Force start music on first interaction
      if (!state.musicPlaying) {
        state.musicPlaying = true;
        await soundManager.playBackgroundMusic();
        testSoundBtn.textContent = '🎵 Music Playing!';
        
        // Update UI
        if (elements.musicText) {
          elements.musicText.textContent = '🎵 Stop';
        }
        
        console.log('🎵 Background music force-started!');
      }
    } catch (error) {
      console.error('Failed to start audio:', error);
    }
  };
  
  document.addEventListener('click', startAudioOnInteraction, { once: true });
  document.addEventListener('keydown', startAudioOnInteraction, { once: true });
  document.addEventListener('touchstart', startAudioOnInteraction, { once: true });
  
  // Check daily challenge
  dailyChallengeSystem.check();
  
  console.log('✅ Game initialized successfully!');
}

// Achievement Badge System
const achievementSystem = {
  badges: {
    3: { icon: '🔥', name: 'Triple Win', color: '#ff6b6b', unlocked: false },
    5: { icon: '⚡', name: 'Unstoppable', color: '#4ecdc4', unlocked: false },
    10: { icon: '👑', name: 'Legendary', color: '#ffd700', unlocked: false },
    15: { icon: '🌟', name: 'Champion', color: '#9b59b6', unlocked: false },
    20: { icon: '💎', name: 'Diamond', color: '#3498db', unlocked: false }
  },

  checkAndUnlockBadges(streak) {
    const badgeContainer = document.getElementById('achievement-badges');
    if (!badgeContainer) return;

    Object.keys(this.badges).forEach(threshold => {
      const badge = this.badges[threshold];
      
      // Unlock new badges
      if (streak >= threshold && !badge.unlocked) {
        badge.unlocked = true;
        this.showBadgeUnlock(badge, threshold);
        this.addBadgeToDisplay(badge, threshold);
      }
      
      // Remove badges when streak drops below threshold
      if (streak < threshold && badge.unlocked) {
        badge.unlocked = false;
        this.removeBadgeFromDisplay(threshold);
      }
    });
  },

  showBadgeUnlock(badge, threshold) {
    const unlockEl = document.createElement('div');
    unlockEl.className = 'badge-unlock';
    unlockEl.innerHTML = `
      <div class="badge-unlock-content">
        <div class="badge-icon">${badge.icon}</div>
        <div class="badge-text">
          <div class="badge-title">Achievement Unlocked!</div>
          <div class="badge-name">${badge.name}</div>
          <div class="badge-desc">${threshold} Win Streak</div>
        </div>
      </div>
    `;
    
    unlockEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, ${badge.color}, #ffffff);
      color: #333;
      padding: 20px;
      border-radius: 15px;
      font-weight: bold;
      z-index: 1001;
      animation: badgeUnlock 3s ease-out forwards;
      box-shadow: 0 15px 40px rgba(0,0,0,0.4);
      border: 3px solid ${badge.color};
      text-align: center;
      min-width: 250px;
    `;

    document.body.appendChild(unlockEl);
    setTimeout(() => {
      if (unlockEl.parentNode) {
        unlockEl.parentNode.removeChild(unlockEl);
      }
    }, 3000);
  },

  addBadgeToDisplay(badge, threshold) {
    const badgeContainer = document.getElementById('achievement-badges');
    if (!badgeContainer) return;

    const badgeEl = document.createElement('div');
    badgeEl.className = 'achievement-badge';
    badgeEl.dataset.threshold = threshold;
    badgeEl.innerHTML = `
      <span class="badge-icon">${badge.icon}</span>
      <span class="badge-name">${badge.name}</span>
    `;
    
    badgeEl.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: linear-gradient(45deg, ${badge.color}, rgba(255,255,255,0.2));
      color: #333;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      margin: 2px;
      border: 2px solid ${badge.color};
      animation: badgePop 0.5s ease-out;
    `;

    badgeContainer.appendChild(badgeEl);
  },

  removeBadgeFromDisplay(threshold) {
    const badgeContainer = document.getElementById('achievement-badges');
    if (!badgeContainer) return;

    const badgeEl = badgeContainer.querySelector(`[data-threshold="${threshold}"]`);
    if (badgeEl) {
      badgeEl.style.animation = 'badgeFadeOut 0.3s ease-out forwards';
      setTimeout(() => {
        if (badgeEl.parentNode) {
          badgeEl.parentNode.removeChild(badgeEl);
        }
      }, 300);
    }
  },

  resetBadges() {
    Object.keys(this.badges).forEach(threshold => {
      this.badges[threshold].unlocked = false;
    });
    const badgeContainer = document.getElementById('achievement-badges');
    if (badgeContainer) {
      badgeContainer.innerHTML = '';
    }
  }
};

// Combo System for streak effects
const comboSystem = {
  checkComboMilestones(streak) {
    // Check for achievement badges first
    achievementSystem.checkAndUnlockBadges(streak);
    
    if (streak === 3) {
      this.showComboMessage('🔥 Triple Win!', '#ff6b6b');
      soundManager.playComboSound(3);
    } else if (streak === 5) {
      this.showComboMessage('⚡ Unstoppable!', '#4ecdc4');
      soundManager.playComboSound(5);
      visualEffects.shakeScreenOnLoss(); // Positive shake
    } else if (streak === 10) {
      this.showComboMessage('👑 LEGENDARY!', '#ffd700');
      soundManager.playComboSound(10);
      this.createFireworks();
    }
  },

  showComboMessage(message, color) {
    const comboEl = document.createElement('div');
    comboEl.className = 'combo-message';
    comboEl.textContent = message;
    comboEl.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(45deg, ${color}, #ffffff);
      color: #333;
      padding: 15px 30px;
      border-radius: 20px;
      font-size: 20px;
      font-weight: bold;
      z-index: 1000;
      animation: comboPopIn 2s ease-out forwards;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      border: 3px solid ${color};
    `;

    document.body.appendChild(comboEl);
    setTimeout(() => {
      if (comboEl.parentNode) {
        comboEl.parentNode.removeChild(comboEl);
      }
    }, 2000);
  },

  createFireworks() {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight * 0.6;
        this.createParticleBurst(x, y);
      }, i * 150);
    }
  },

  createParticleBurst(x, y) {
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: 8px;
        height: 8px;
        background: hsl(${Math.random() * 360}, 70%, 60%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 999;
      `;

      const angle = (Math.PI * 2 * i) / 20;
      const velocity = 100 + Math.random() * 100;
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;

      particle.animate([
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: `translate(${vx}px, ${vy + 200}px)`, opacity: 0 }
      ], {
        duration: 1000,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      });

      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 1000);
    }
  }
};

// Enhanced particle system
const particleSystem = {
  init() {
    this.createFloatingParticles();
  },

  createFloatingParticles() {
    const container = document.getElementById('background-particles');
    if (!container) return;

    for (let i = 0; i < 25; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: ${2 + Math.random() * 3}px;
        height: ${2 + Math.random() * 3}px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        animation: particleFloat ${8 + Math.random() * 4}s linear infinite;
        animation-delay: ${Math.random() * 8}s;
      `;
      container.appendChild(particle);
    }
  }
};

// Add combo animation styles
const comboStyles = document.createElement('style');
comboStyles.textContent = `
  @keyframes comboPopIn {
    0% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
  }
  
  @keyframes badgeUnlock {
    0% {
      transform: translate(-50%, -50%) scale(0) rotate(-180deg);
      opacity: 0;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1) rotate(0deg);
      opacity: 1;
    }
  }
  
  @keyframes badgePop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.2);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  @keyframes badgeFadeOut {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(0);
      opacity: 0;
    }
  }
  
  .achievement-badges {
    margin: 10px 0;
    text-align: center;
    min-height: 30px;
  }
  
  .achievement-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin: 2px;
    font-size: 12px;
    font-weight: bold;
  }
  
  .badge-unlock-content {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .badge-icon {
    font-size: 2rem;
  }
  
  .badge-title {
    font-size: 14px;
    margin-bottom: 5px;
    color: #666;
  }
  
  .badge-name {
    font-size: 18px;
    margin-bottom: 3px;
  }
  
  .badge-desc {
    font-size: 12px;
    color: #666;
  }
  
  .background-particles {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }
  
  .streak-container {
    margin: 1rem 0;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 15px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .streak-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .streak-label {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .streak-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--accent-primary);
    text-shadow: 0 0 10px var(--accent-primary);
  }
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
    border-radius: 4px;
    transition: width 0.5s ease;
    box-shadow: 0 0 10px var(--accent-primary);
  }
`;
document.head.appendChild(comboStyles);

// Challenge Manager
const challengeManager = {
  start() {
    state.challengeMode.active = true;
    state.challengeMode.current = 0;
    state.challengeMode.timeLeft = state.challengeMode.timeLimit;
    this.updateDisplay();
    this.startTimer();
    showNotification(`🎯 Challenge: Get ${state.challengeMode.target} wins in ${state.challengeMode.timeLimit} seconds!`);
  },
  
  stop() {
    state.challengeMode.active = false;
    if (this.challengeTimer) {
      clearInterval(this.challengeTimer);
      this.challengeTimer = null;
    }
  },
  
  startTimer() {
    this.challengeTimer = setInterval(() => {
      state.challengeMode.timeLeft--;
      this.updateDisplay();
      
      if (state.challengeMode.timeLeft <= 0) {
        this.timeUp();
      }
    }, 1000);
  },
  
  updateDisplay() {
    if (elements.resultText) {
      elements.resultText.textContent = `Challenge: ${state.challengeMode.current}/${state.challengeMode.target} wins | Time: ${state.challengeMode.timeLeft}s`;
    }
  },
  
  onWin() {
    if (!state.challengeMode.active) return;
    
    state.challengeMode.current++;
    if (state.challengeMode.current >= state.challengeMode.target) {
      this.challengeComplete();
    } else {
      this.updateDisplay();
    }
  },
  
  challengeComplete() {
    this.stop();
    visualEffects.fireConfetti();
    showNotification('🎉 Challenge Complete! You earned bonus XP!');
    levelSystem.addExperience(100);
    powerUpSystem.grantRandomPowerUp();
  },
  
  timeUp() {
    this.stop();
    showNotification('⏰ Challenge Failed! Time\'s up!');
  }
};

// Tournament Manager
const tournamentManager = {
  start() {
    state.tournament.active = true;
    state.tournament.round = 1;
    state.tournament.wins = 0;
    state.tournament.losses = 0;
    this.updateDisplay();
    showNotification(`🏆 Tournament Started! Best of ${state.tournament.maxRounds} rounds`);
  },
  
  stop() {
    state.tournament.active = false;
  },
  
  updateDisplay() {
    if (elements.resultText) {
      elements.resultText.textContent = `Tournament Round ${state.tournament.round}/${state.tournament.maxRounds} | Wins: ${state.tournament.wins} | Losses: ${state.tournament.losses}`;
    }
  },
  
  onGameEnd(result) {
    if (!state.tournament.active) return;
    
    if (result === 'win') {
      state.tournament.wins++;
    } else if (result === 'lose') {
      state.tournament.losses++;
    }
    
    state.tournament.round++;
    
    if (state.tournament.round > state.tournament.maxRounds) {
      this.tournamentEnd();
    } else {
      this.updateDisplay();
    }
  },
  
  tournamentEnd() {
    this.stop();
    const winRate = (state.tournament.wins / state.tournament.maxRounds) * 100;
    
    if (state.tournament.wins > state.tournament.losses) {
      visualEffects.fireConfetti();
      showNotification(`🏆 Tournament Won! ${state.tournament.wins}/${state.tournament.maxRounds} wins!`);
      levelSystem.addExperience(200);
    } else {
      showNotification(`🥈 Tournament Complete! ${state.tournament.wins}/${state.tournament.maxRounds} wins`);
      levelSystem.addExperience(50);
    }
  }
};

// Power-Up System
const powerUpSystem = {
  use(powerUpType) {
    if (state.powerUps[powerUpType] <= 0) return false;
    
    state.powerUps[powerUpType]--;
    
    switch (powerUpType) {
      case 'shield':
        state.shieldActive = true;
        showNotification('🛡️ Shield Active! Next loss will be blocked.');
        break;
      case 'doubleWin':
        state.doubleWinActive = true;
        showNotification('⚡ Double Win Active! Next win counts as 2.');
        break;
      case 'peek':
        this.revealComputerChoice();
        break;
      case 'timeFreeze':
        this.freezeTimer();
        break;
    }
    
    this.updatePowerUpDisplay();
    return true;
  },
  
  grantRandomPowerUp() {
    const powerUps = ['shield', 'doubleWin', 'peek', 'timeFreeze'];
    const randomPowerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
    state.powerUps[randomPowerUp]++;
    showNotification(`🎁 Power-up earned: ${this.getPowerUpName(randomPowerUp)}!`);
    this.updatePowerUpDisplay();
  },
  
  getPowerUpName(type) {
    const names = {
      shield: '🛡️ Shield',
      doubleWin: '⚡ Double Win',
      peek: '👁️ Peek',
      timeFreeze: '❄️ Time Freeze'
    };
    return names[type];
  },
  
  revealComputerChoice() {
    const computerChoice = getComputerChoice();
    showNotification(`👁️ Computer will choose: ${CHOICE_EMOJIS[computerChoice]}`);
    setTimeout(() => {
      showNotification('Peek effect expired!');
    }, 3000);
  },
  
  freezeTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      showNotification('❄️ Timer Frozen for 5 seconds!');
      setTimeout(() => {
        if (state.mode === 'timed') {
          timerManager.start();
        }
        showNotification('Timer unfrozen!');
      }, 5000);
    }
  },
  
  updatePowerUpDisplay() {
    // Update power-up display in achievements panel
    const badgeContainer = elements.achievementBadges;
    if (!badgeContainer) return;
    
    // Remove existing power-up displays
    const existingPowerUps = badgeContainer.querySelectorAll('.powerup-display');
    existingPowerUps.forEach(el => el.remove());
    
    // Add current power-ups
    Object.entries(state.powerUps).forEach(([type, count]) => {
      if (count > 0) {
        const powerUpEl = document.createElement('div');
        powerUpEl.className = 'powerup-display';
        powerUpEl.innerHTML = `
          <span class="powerup-icon">${this.getPowerUpIcon(type)}</span>
          <span class="powerup-count">${count}</span>
        `;
        powerUpEl.style.cssText = `
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background: rgba(255, 255, 255, 0.2);
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: bold;
          margin: 0.125rem;
        `;
        badgeContainer.appendChild(powerUpEl);
      }
    });
  },
  
  getPowerUpIcon(type) {
    const icons = {
      shield: '🛡️',
      doubleWin: '⚡',
      peek: '👁️',
      timeFreeze: '❄️'
    };
    return icons[type] || '🎁';
  }
};

// Level System
const levelSystem = {
  addExperience(amount) {
    state.experience += amount;
    
    while (state.experience >= state.experienceToNext) {
      this.levelUp();
    }
    
    this.updateDisplay();
  },
  
  levelUp() {
    state.experience -= state.experienceToNext;
    state.playerLevel++;
    state.experienceToNext = Math.floor(state.experienceToNext * 1.2);
    
    visualEffects.fireConfetti();
    showNotification(`🌟 Level Up! You are now level ${state.playerLevel}!`);
    
    // Grant power-up on level up
    powerUpSystem.grantRandomPowerUp();
  },
  
  updateDisplay() {
    if (elements.playerLevel) {
      elements.playerLevel.textContent = `Level ${state.playerLevel}`;
    }
    
    if (elements.currentXp) {
      elements.currentXp.textContent = state.experience;
    }
    
    if (elements.nextLevelXp) {
      elements.nextLevelXp.textContent = state.experienceToNext;
    }
    
    if (elements.xpProgress) {
      const progressPercent = (state.experience / state.experienceToNext) * 100;
      elements.xpProgress.style.width = progressPercent + '%';
    }
  }
};

// Daily Challenge System
const dailyChallengeSystem = {
  check() {
    const today = new Date().toDateString();
    
    if (state.dailyChallenge.date !== today) {
      // New day, reset challenge
      state.dailyChallenge.date = today;
      state.dailyChallenge.completed = false;
      state.dailyChallenge.progress = 0;
      state.dailyChallenge.target = 3 + Math.floor(Math.random() * 5); // 3-7 wins
      
      showNotification(`📅 New Daily Challenge: Get ${state.dailyChallenge.target} wins!`);
    }
  },
  
  onWin() {
    if (state.dailyChallenge.completed) return;
    
    state.dailyChallenge.progress++;
    
    if (state.dailyChallenge.progress >= state.dailyChallenge.target) {
      state.dailyChallenge.completed = true;
      visualEffects.fireConfetti();
      showNotification('🎉 Daily Challenge Complete! Bonus rewards earned!');
      levelSystem.addExperience(150);
      powerUpSystem.grantRandomPowerUp();
      powerUpSystem.grantRandomPowerUp();
    } else {
      showNotification(`📅 Daily Progress: ${state.dailyChallenge.progress}/${state.dailyChallenge.target}`);
    }
  }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
