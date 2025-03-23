# Contributing to Citation Verifier

Thank you for considering contributing to the Citation Verifier project! This document outlines the process for contributing to the project.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with the following information:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs. actual behavior
- System information (OS, Node.js version, etc.)
- Any relevant logs or screenshots

### Suggesting Features

We welcome feature suggestions! When suggesting a feature, please:

- Provide a clear description of the feature
- Explain how it would benefit the project
- If possible, outline how it might be implemented

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Run tests and linting to ensure code quality
5. Commit your changes (`git commit -m 'Add some feature'`)
6. Push to the branch (`git push origin feature/your-feature-name`)
7. Create a Pull Request

## Development Setup

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/citation-verifier.git
   cd citation-verifier
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a local `.env` file
   ```bash
   cp .env.example .env
   ```

4. Set up GROBID for development
   ```bash
   docker pull grobid/grobid:0.8.1
   docker run -p 8070:8070 grobid/grobid:0.8.1
   ```

5. Run development server
   ```bash
   npm run dev
   ```

## Code Style

- Use TypeScript for all new code
- Follow the existing code style and organization
- Add JSDoc comments for public APIs
- Maintain test coverage for new features

## Commit Messages

Please use clear, descriptive commit messages that explain what changes you've made. Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification when possible.

## Testing

Before submitting a PR, please ensure:

- All existing tests pass
- New tests are added for new functionality
- Code is properly linted

Run tests with:
```bash
npm test
```

Run linting with:
```bash
npm run lint
```

## License

By contributing to Citation Verifier, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).

## Questions?

If you have any questions about contributing, please open an issue or contact the project maintainers.

Thank you for your contributions!
