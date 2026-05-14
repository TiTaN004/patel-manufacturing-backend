<?php
/**
 * Bulk User Cleanup Cron Script
 * Runs at 00:00 IST to hard delete users 30 days after soft deletion
 * 
 * Cron: /usr/local/bin/php /home/btakyall/patel-box/backend/scripts/cleanup-expired-users.php
 */

date_default_timezone_set('Asia/Kolkata');

define('LOG_FILE', __DIR__ . '/../logs/cleanup.log');
define('ENV_FILE', __DIR__ . '/../.env');
define('LOG_MAX_LINES', 10000);

function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if ($key !== '') {
                $_ENV[$key] = $value;
                putenv("$key=$value");
            }
        }
    }
}

function logMessage($message) {
    $logDir = dirname(LOG_FILE);
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    $timestamp = date('Y-m-d H:i:s');
    $logLine = "[$timestamp] $message\n";
    file_put_contents(LOG_FILE, $logLine, FILE_APPEND);
    echo $logLine;
}

function rotateLog($maxLines = LOG_MAX_LINES) {
    if (!file_exists(LOG_FILE)) return;
    $lines = file(LOG_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (count($lines) > $maxLines) {
        $lines = array_slice($lines, -$maxLines);
        file_put_contents(LOG_FILE, implode("\n", $lines) . "\n");
        logMessage("🔄 Log rotated to last $maxLines lines");
    }
}

function sendEmail($to, $subject, $html) {
    $fromName = $_ENV['SMTP_FROM_NAME'] ?? 'Admin';
    $fromEmail = $_ENV['SMTP_FROM'] ?? '';

    $headers = "From: $fromName <$fromEmail>\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    return mail($to, $subject, $html, $headers);
}

function sendErrorEmail($errorMessage) {
    try {
        $db = new mysqli(
            $_ENV['DB_HOST'] ?? '',
            $_ENV['DB_USER'] ?? '',
            $_ENV['DB_PASSWORD'] ?? '',
            $_ENV['DB_NAME'] ?? ''
        );
        if (!$db->connect_error) {
            $result = $db->query("SELECT emailID FROM user WHERE isAdmin = 1 AND isActive = 1 AND deleted_at IS NULL");
            if ($result) {
                $admins = $result->fetch_all(MYSQLI_ASSOC);
                $currentDate = date('Y-m-d H:i:s');
                $subject = "[Error] Bulk User Cleanup Failed";

                $emailBody = "
                <h2>❌ Bulk User Cleanup Failed</h2>
                <p>Date: $currentDate</p>
                <p>Error: " . htmlspecialchars($errorMessage) . "</p>
                <p>Please check the logs for details.</p>
                <hr>
                <p style='color: #666; font-size: 12px;'>This is an automated message from the system.</p>";

                foreach ($admins as $admin) {
                    $adminEmail = $admin['emailID'] ?? '';
                    if (!empty($adminEmail)) {
                        sendEmail($adminEmail, $subject, $emailBody);
                    }
                }
            }
            $db->close();
        }
    } catch (Exception $e) {
        // Silently fail
    }
}

function runCleanup() {
    logMessage("🚀 Starting bulk user cleanup...");

    if (!file_exists(ENV_FILE)) {
        logMessage("❌ .env file not found at: " . ENV_FILE);
        exit(1);
    }

    loadEnv(ENV_FILE);
    logMessage("✅ .env loaded");

    $db = new mysqli(
        $_ENV['DB_HOST'] ?? '',
        $_ENV['DB_USER'] ?? '',
        $_ENV['DB_PASSWORD'] ?? '',
        $_ENV['DB_NAME'] ?? ''
    );

    if ($db->connect_error) {
        logMessage("❌ Database connection failed: " . $db->connect_error);
        sendErrorEmail("Database connection failed: " . $db->connect_error);
        exit(1);
    }

    logMessage("✅ Database connected");

    $result = $db->query("
        SELECT pud.user_id, pud.deleted_at, pud.hard_delete_at,
               u.fullName, u.emailID, u.mobileNo
        FROM pending_user_deletions pud
        JOIN user u ON pud.user_id = u.userID
        WHERE pud.hard_delete_at <= NOW()
    ");

    if (!$result) {
        logMessage("❌ Query failed: " . $db->error);
        sendErrorEmail("Query failed: " . $db->error);
        $db->close();
        exit(1);
    }

    $expiredUsers = $result->fetch_all(MYSQLI_ASSOC);

    if (count($expiredUsers) === 0) {
        logMessage("ℹ️  No expired users to delete");
        $db->close();
        rotateLog();
        return;
    }

    logMessage("📦 Found " . count($expiredUsers) . " users to delete");

    $rowsHtml = '';
    foreach ($expiredUsers as $user) {
        $userId = htmlspecialchars($user['user_id']);
        $fullName = htmlspecialchars($user['fullName'] ?? 'Unknown');
        $email = htmlspecialchars($user['emailID'] ?? 'N/A');
        $mobile = htmlspecialchars($user['mobileNo'] ?? 'N/A');
        $deletedAt = htmlspecialchars($user['deleted_at'] ?? 'N/A');
        $hardDelete = htmlspecialchars($user['hard_delete_at'] ?? 'N/A');

        logMessage("👤 User $userId: $fullName ($email) - Soft deleted: $deletedAt, Scheduled: $hardDelete");

        $rowsHtml .= "<tr>
            <td>$userId</td>
            <td>$fullName</td>
            <td>$email</td>
            <td>$mobile</td>
            <td>$deletedAt</td>
            <td>$hardDelete</td>
        </tr>\n";
    }

    $userIds = array_column($expiredUsers, 'user_id');
    $db->begin_transaction();

    try {
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $types = str_repeat('i', count($userIds));

        $stmt = $db->prepare("DELETE FROM pending_user_deletions WHERE user_id IN ($placeholders)");
        $stmt->bind_param($types, ...$userIds);
        $stmt->execute();
        $removedCount = $stmt->affected_rows;
        logMessage("🗑️  Removed $removedCount records from pending_user_deletions");

        $stmt = $db->prepare("DELETE FROM user WHERE userID IN ($placeholders)");
        $stmt->bind_param($types, ...$userIds);
        $stmt->execute();
        $deletedCount = $stmt->affected_rows;
        logMessage("🗑️  Hard deleted $deletedCount users");

        $db->commit();
        logMessage("✅ Transaction committed");

        $adminResult = $db->query("SELECT emailID FROM user WHERE isAdmin = 1 AND isActive = 1 AND deleted_at IS NULL");
        $admins = $adminResult ? $adminResult->fetch_all(MYSQLI_ASSOC) : [];

        if (count($admins) > 0) {
            $currentDate = date('Y-m-d H:i:s');
            $subject = "[Completed] Bulk User Deletion - " . count($expiredUsers) . " users deleted";

            $emailBody = "
            <h2>✅ Bulk User Deletion Complete</h2>
            <p>Date: $currentDate</p>
            <p>The following bulk users have been <strong>permanently deleted</strong>:</p>
            <table border='1' cellpadding='8' cellspacing='0' style='border-collapse: collapse; width: 100%; max-width: 900px;'>
                <tr style='background: #4CAF50; color: white;'>
                    <th>User ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>Deleted On</th><th>Scheduled For</th>
                </tr>
                $rowsHtml
            </table>
            <hr>
            <p style='color: #666; font-size: 12px;'>This is an automated message from the system.</p>";

            $sentCount = 0;
            foreach ($admins as $admin) {
                $adminEmail = $admin['emailID'] ?? '';
                if (!empty($adminEmail)) {
                    if (sendEmail($adminEmail, $subject, $emailBody)) {
                        $sentCount++;
                        logMessage("📧 Completion email sent to: $adminEmail");
                    } else {
                        logMessage("⚠️  Failed to send completion email to: $adminEmail");
                    }
                }
            }

            logMessage("📧 Completion emails sent to $sentCount of " . count($admins) . " admins");
        } else {
            logMessage("⚠️  No admin emails found to send notification");
        }

    } catch (Exception $e) {
        $db->rollback();
        logMessage("❌ Transaction failed: " . $e->getMessage());
        sendErrorEmail("Transaction failed: " . $e->getMessage());
        $db->close();
        exit(1);
    }

    $db->close();
    rotateLog();
    logMessage("✅ Cleanup completed successfully");
}

runCleanup();
