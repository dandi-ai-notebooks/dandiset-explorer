import { useEffect, useState } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import AdminChatsPage from './pages/AdminChatsPage';
import ChatPage from './pages/ChatPage';

function App() {
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const headerHeight = 40; // Fixed header height in pixels

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Router>
      <div className="app">
        {/* <header style={{ height: headerHeight, display: 'flex', alignItems: 'center', padding: '0 20px', backgroundColor: '#282c34', color: 'white', fontFamily: 'Comfortaa, sans-serif' }}>
          <h1><Link to="/dandiset-explorer/" style={{ textDecoration: 'none', color: 'inherit', marginRight: '20px' }}>Dandiset Explorer</Link></h1>
          <Link to="/dandiset-explorer/admin" style={{ textDecoration: 'none', color: 'inherit' }}>Admin</Link>
        </header> */}

        <Routes>
          <Route
            path="/dandiset-explorer/"
            element={
              <Navigate to="/dandiset-explorer/chat" />
            }
          />
          <Route
            path="/dandiset-explorer/chat"
            element={
              <ChatPage
                width={windowDimensions.width}
                height={windowDimensions.height - headerHeight}
              />
            }
          />
          <Route
            path="/dandiset-explorer/admin"
            element={
              <AdminChatsPage
                width={windowDimensions.width}
                height={windowDimensions.height - headerHeight}
              />
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
