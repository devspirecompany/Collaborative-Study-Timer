// Tutorial content for each feature

export const tutorials = {
  dashboard: {
    icon: '📊',
    title: 'Welcome to Your Dashboard!',
    description: 'Your dashboard is your command center. Here\'s how to make the most of it:',
    steps: [
      {
        title: 'View Your Stats',
        description: 'See your daily study hours, weekly progress, study streak, and active group sessions at a glance.',
        hint: 'Stats update automatically as you study!'
      },
      {
        title: 'Quick Timer Access',
        description: 'Use the timer widget to start a quick study session. The AI recommends optimal study duration based on your patterns.',
        hint: 'Click "Go to Study Timer" for full timer features.'
      },
      {
        title: 'Track Weekly Progress',
        description: 'Monitor your study hours throughout the week with the interactive progress chart.',
        hint: 'Hover over bars to see exact hours studied.'
      },
      {
        title: 'View Recent Activity',
        description: 'Stay updated with your latest achievements, study sessions, and group activities.',
        hint: 'Activities are sorted by most recent first.'
      }
    ],
    tips: [
      'Set daily study goals to stay motivated',
      'Check your streak daily to maintain consistency',
      'Use the quick timer for short study bursts'
    ]
  },
  studyTimer: {
    icon: '⏱️',
    title: 'How to Use the Study Timer',
    description: 'Master the Pomodoro technique with AI-powered study sessions:',
    steps: [
      {
        title: 'Select Study Material',
        description: 'Before starting, select a file or reviewer to study with. Click "Select File" to choose from your uploaded materials.',
        hint: 'You must select a file before starting the timer!'
      },
      {
        title: 'Choose Study Mode',
        description: 'Select between Study mode (focused work) or Break mode (rest periods). Each mode has different duration options.',
        hint: 'AI recommends optimal study duration based on your history.'
      },
      {
        title: 'Start Your Session',
        description: 'Click the Start button to begin. The timer will count down and track your progress.',
        hint: 'You can pause, reset, or skip sessions anytime.'
      },
      {
        title: 'Complete & Track',
        description: 'When the timer ends, your session is automatically saved. View your progress in the dashboard.',
        hint: 'Completed sessions contribute to your daily and weekly stats.'
      }
    ],
    tips: [
      'Take breaks between study sessions for better retention',
      'Use break mode to rest your mind',
      'Enable auto-start breaks for seamless transitions'
    ]
  },
  myFiles: {
    icon: '📁',
    title: 'Managing Your Study Files',
    description: 'Organize and manage all your study materials in one place:',
    steps: [
      {
        title: 'Upload Files',
        description: 'Click "Upload File" to add PDF, DOCX, or TXT files. Files are automatically organized by subject.',
        hint: 'Supported formats: PDF, Word documents, and text files.'
      },
      {
        title: 'Create Folders',
        description: 'Organize files by creating folders. Click "Create Folder" and give it a name.',
        hint: 'Folders help you group related study materials.'
      },
      {
        title: 'Generate Reviewers',
        description: 'Select a file and click "Create Reviewer" to generate AI-powered study notes and questions.',
        hint: 'Reviewers make it easier to study and practice!'
      },
      {
        title: 'Filter by Subject',
        description: 'Use the subject filter to quickly find files. Click on a subject tag to filter.',
        hint: 'Files are automatically tagged by subject when uploaded.'
      }
    ],
    tips: [
      'Upload files before starting study sessions',
      'Create reviewers for important materials',
      'Organize files into folders by course or topic'
    ]
  },
  groupStudy: {
    icon: '👥',
    title: 'Collaborative Study & Competitions',
    description: 'Study with friends and compete in real-time quizzes:',
    steps: [
      {
        title: 'Choose Study Mode',
        description: 'Select between Competition (1v1 battles) or Collaborative Study (group rooms).',
        hint: 'Competitions are fast-paced, rooms are collaborative.'
      },
      {
        title: 'Create or Join',
        description: 'Create a room/competition or join an existing one using a room code.',
        hint: 'Share room codes with friends to study together.'
      },
      {
        title: 'Start Quiz',
        description: 'In collaborative rooms, the host can start a quiz. Select a file and generate questions.',
        hint: 'Everyone answers together and sees explanations.'
      },
      {
        title: 'Compete & Learn',
        description: 'Answer questions quickly and accurately. See real-time scores and leaderboards.',
        hint: 'Speed and accuracy both matter in competitions!'
      }
    ],
    tips: [
      'Invite friends using room codes',
      'Host can control quiz settings',
      'Review explanations after each question'
    ]
  },
  soloPractice: {
    icon: '🎯',
    title: 'Solo Practice Mode',
    description: 'Practice questions at your own pace:',
    steps: [
      {
        title: 'Select a File',
        description: 'Choose a file from your library to generate practice questions from.',
        hint: 'Questions are AI-generated from your file content.'
      },
      {
        title: 'Choose Question Type',
        description: 'Select multiple choice, true/false, or fill-in-the-blank questions.',
        hint: 'Different question types test different skills.'
      },
      {
        title: 'Set Question Count',
        description: 'Choose how many questions you want (5, 10, 15, or 20).',
        hint: 'Start with fewer questions if you\'re new to the topic.'
      },
      {
        title: 'Practice & Review',
        description: 'Answer questions and see immediate feedback. Review explanations to learn.',
        hint: 'Take your time - there\'s no time limit in practice mode!'
      }
    ],
    tips: [
      'Use practice mode to prepare for exams',
      'Review explanations to understand concepts',
      'Practice regularly to improve retention'
    ]
  },
  achievements: {
    icon: '🏆',
    title: 'Achievements & Rewards',
    description: 'Track your progress and unlock achievements:',
    steps: [
      {
        title: 'View Achievements',
        description: 'See all available achievements and your progress toward unlocking them.',
        hint: 'Achievements are automatically unlocked as you study.'
      },
      {
        title: 'Track Progress',
        description: 'Each achievement shows your current progress and what\'s needed to unlock it.',
        hint: 'Hover over achievements to see details.'
      },
      {
        title: 'Celebrate Milestones',
        description: 'Get notified when you unlock new achievements. Share your progress!',
        hint: 'Achievements appear in your recent activity.'
      }
    ],
    tips: [
      'Set goals based on achievement requirements',
      'Check achievements regularly for motivation',
      'Some achievements unlock special features'
    ]
  },
  productivityTracker: {
    icon: '📈',
    title: 'Productivity Tracking',
    description: 'Monitor your study habits and improve productivity:',
    steps: [
      {
        title: 'View Analytics',
        description: 'See detailed charts and graphs of your study patterns, time distribution, and productivity trends.',
        hint: 'Data updates automatically as you study.'
      },
      {
        title: 'Set Goals',
        description: 'Set daily and weekly study goals. Track your progress toward these goals.',
        hint: 'Realistic goals help maintain consistency.'
      },
      {
        title: 'Analyze Patterns',
        description: 'Identify your most productive times and subjects. Use insights to optimize your schedule.',
        hint: 'Look for patterns in your study data.'
      },
      {
        title: 'Get AI Insights',
        description: 'Receive personalized recommendations based on your study habits and productivity data.',
        hint: 'AI suggestions help you study more effectively.'
      }
    ],
    tips: [
      'Review your productivity weekly',
      'Adjust goals based on your progress',
      'Use insights to find your optimal study times'
    ]
  },
  studyRoom: {
    icon: '🏠',
    title: 'Collaborative Study Rooms',
    description: 'Study together in real-time with friends:',
    steps: [
      {
        title: 'Join or Create Room',
        description: 'Create a new room or join using a room code. Share the code with your study group.',
        hint: 'Room codes are case-insensitive and easy to share.'
      },
      {
        title: 'Share Files',
        description: 'Upload and share study materials with everyone in the room. View files together.',
        hint: 'Only the host can share files initially.'
      },
      {
        title: 'Synchronized Viewing',
        description: 'Everyone sees the same document. Scroll position syncs automatically.',
        hint: 'Perfect for group study sessions!'
      },
      {
        title: 'Chat & Notes',
        description: 'Use the chat to discuss topics. Add shared notes to important sections.',
        hint: 'Notes are visible to everyone in the room.'
      },
      {
        title: 'Group Quizzes',
        description: 'Host can start quizzes for everyone. Answer together and see results.',
        hint: 'Quizzes are great for group review sessions.'
      }
    ],
    tips: [
      'Use rooms for group projects',
      'Share important files early',
      'Take advantage of synchronized viewing'
    ]
  }
};

// Helper function to check if tutorial has been shown
export const hasSeenTutorial = (tutorialKey) => {
  const seen = localStorage.getItem('tutorials_seen');
  if (!seen) return false;
  const seenList = JSON.parse(seen);
  return seenList.includes(tutorialKey);
};

// Helper function to mark tutorial as seen
export const markTutorialAsSeen = (tutorialKey) => {
  const seen = localStorage.getItem('tutorials_seen');
  const seenList = seen ? JSON.parse(seen) : [];
  if (!seenList.includes(tutorialKey)) {
    seenList.push(tutorialKey);
    localStorage.setItem('tutorials_seen', JSON.stringify(seenList));
  }
};

// Helper function to reset all tutorials (for testing)
export const resetTutorials = () => {
  localStorage.removeItem('tutorials_seen');
};

