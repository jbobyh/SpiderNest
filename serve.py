import http.server
import socketserver

mimetypes = http.server.SimpleHTTPRequestHandler.extensions_map
mimetypes['.mjs'] = 'application/javascript'
mimetypes['.js']  = 'application/javascript'

PORT = 8000

with socketserver.TCPServer(("", PORT), http.server.SimpleHTTPRequestHandler) as httpd:
    print(f"Serving HTTP on port {PORT} (http://localhost:{PORT}/)")
    httpd.serve_forever()
