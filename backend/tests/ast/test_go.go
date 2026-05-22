package main

// Server represents our HTTP server.
// It handles routing.
type Server struct {
	port int
}

// Start begins listening on the configured port.
// Notice there is no space between this comment and the func!
func (s *Server) Start() error {
	return nil
}

// topLevelFunc is an orphan function.
func topLevelFunc() {}
