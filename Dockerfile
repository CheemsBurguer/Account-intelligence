# ─────────────────────────────────────────────
# Dockerfile.backend (Production - Azure Ready)
# Python 3.11 + uv + PostgreSQL
# ─────────────────────────────────────────────

FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install system dependencies (minimal required)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first (better layer caching)
COPY pyproject.toml uv.lock* ./

# Create virtual environment and install dependencies
RUN uv venv
RUN uv sync --frozen

# Add venv to PATH
ENV PATH="/app/.venv/bin:$PATH"

# Copy application code
COPY src/backend/app ./app
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini

# Create non-root user
RUN useradd -m -u 1001 appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["sh", "-c", "${STARTUP_COMMAND}"]