module.exports = {
  theme: {
    extend: {
      animation: {
        'slide-in-left': 'slide-in-left 0.3s ease-out',
      },
      keyframes: {
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
} 