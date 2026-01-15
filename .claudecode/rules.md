# Claude Code Rules for This Project

## Git Commit Rules

### CRITICAL: No AI Attribution in Commits
- **NEVER** add `Co-Authored-By: Claude` or any AI attribution to commit messages
- User wants commits to appear as their own work
- Keep commit messages clean and professional without AI tags

### Commit Message Format
```
<type>: <subject>

<body>
```

**Types:** feat, fix, docs, style, refactor, test, chore

### Example Good Commit
```
feat: Add Docker setup with hot reload

- Setup Docker Compose for Backend and Frontend
- Configure MongoDB container
- Add hot reload for development
```

### Example Bad Commit (DO NOT DO THIS)
```
feat: Add Docker setup

...

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>  ❌ NEVER DO THIS
```

## Project Preferences

### Environment Variables
- Use single unified `.env` file at root
- Never create separate `.env` files for services
- All secrets in one place for easy management

### Docker
- Always use hot reload for development
- Backend uses nodemon
- Frontend uses Next.js dev mode
- Keep container names prefixed with `topikgo-`

### Code Style
- Clean, production-ready code
- No unnecessary comments about Claude or AI assistance
- Professional documentation only
