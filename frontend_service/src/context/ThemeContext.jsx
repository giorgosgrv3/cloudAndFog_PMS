import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Load saved theme or default to 'default'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('pms-theme') || 'default';
  });

  useEffect(() => {
    // IMPORTANT: This sets the attribute on the <body> tag
    // The CSS selectors like [data-theme="office"] rely on this.
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('pms-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};