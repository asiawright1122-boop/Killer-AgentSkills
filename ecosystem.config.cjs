module.exports = {
    apps: [{
        name: "killer-skills-pipeline",
        script: "./scripts/run-pipeline.sh",
        args: "--once", // We use PM2's restart capabilities instead of internal loop
        cron_restart: "0 * * * *", // Run every hour (at minute 0)
        autorestart: false, // Don't restart immediately if it exits (cron handles it)
        watch: false,
        max_memory_restart: "500M",
        env: {
            NODE_ENV: "production",
        },
        error_file: "logs/pm2-error.log",
        out_file: "logs/pm2-out.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    }]
}
