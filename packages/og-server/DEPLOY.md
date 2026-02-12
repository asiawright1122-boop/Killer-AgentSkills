# OG Server Deployment Guide

This service generates dynamic Open Graph images for Killer-Skills. It is designed to run on a VPS (Oracle Cloud) to bypass Cloudflare Workers size limits.

## 1. Prerequisites
- A server with Docker installed.
- Public IP address (e.g., `123.45.67.89`).
- Domain (optional, e.g., `og.killer-skills.com`) point to this IP.

## 2. Deploy Method A: Build on Server (Recommended for 1GB RAM)
Since the server has low RAM, building Next.js might be tight, but this is a small app so it might pass.

1.  **Transfer files** to server:
    ```bash
    scp -r packages/og-server user@your-ip:~/og-server
    ```
2.  **SSH into server**:
    ```bash
    ssh user@your-ip
    cd ~/og-server
    ```
3.  **Build Docker Image**:
    ```bash
    docker build -t og-server .
    ```
4.  **Run Container**:
    ```bash
    docker run -d -p 3000:3000 --name og-server --restart always og-server
    ```

## 3. Deploy Method B: Build Locally & Push (Recommended)
Build on your powerful machine and push the image.

1.  **Build Locally**:
    ```bash
    cd packages/og-server
    docker build -t your-dockerhub-user/og-server:latest .
    ```
2.  **Push**:
    ```bash
    docker push your-dockerhub-user/og-server:latest
    ```
3.  **Pull & Run on Server**:
    ```bash
    docker run -d -p 3000:3000 --name og-server --restart always your-dockerhub-user/og-server
    ```

## 4. Verify
Visit `http://<your-ip>:3000/api/og?title=Hello&description=World` to see the generated image.

## 5. Update Main Site
Once deployed, update `src/app/api/og/route.tsx.disabled` (rename back to `route.tsx` or create new file) in the main app to proxy requests to this server OR update your metadata generation logic to point `og:image` to this server's URL.

**Recommended Integration:**
In `src/app/[locale]/skills/[owner]/[repo]/page.tsx`:
```typescript
openGraph: {
  images: [`https://og.killer-skills.com/api/og?title=${skill.name}...`],
}
```
