<?php
/**
 * Bulk User Deletion Warning Script
 * Runs at 23:59 IST to warn admins about users to be deleted tomorrow
 * 
 * Cron: /usr/local/bin/php /home/btakyall/patel-box/backend/scripts/send-deletion-warning.php
 */

date_default_timezone_set('Asia/Kolkata');

define('LOG_FILE', __DIR__ . '/../logs/warning.log');
// define('ENV_FILE', __DIR__ . '/../.env');
define('LOG_MAX_LINES', 10000);

// function loadEnv($path)
// {
//     if (!file_exists($path))
//         return;
//     $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
//     foreach ($lines as $line) {
//         $line = trim($line);
//         if ($line === '' || strpos($line, '#') === 0)
//             continue;
//         if (strpos($line, '=') !== false) {
//             list($key, $value) = explode('=', $line, 2);
//             $key = trim($key);
//             $value = trim($value);
//             if ($key !== '') {
//                 $_ENV[$key] = $value;
//                 putenv("$key=$value");
//             }
//         }
//     }
// }

function logMessage($message)
{
    $logDir = dirname(LOG_FILE);
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    $timestamp = date('Y-m-d H:i:s');
    $logLine = "[$timestamp] $message\n";
    file_put_contents(LOG_FILE, $logLine, FILE_APPEND);
    echo $logLine;
}

function rotateLog($maxLines = LOG_MAX_LINES)
{
    if (!file_exists(LOG_FILE))
        return;
    $lines = file(LOG_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (count($lines) > $maxLines) {
        $lines = array_slice($lines, -$maxLines);
        file_put_contents(LOG_FILE, implode("\n", $lines) . "\n");
        logMessage("🔄 Log rotated to last $maxLines lines");
    }
}

function sendEmail($to, $subject, $html)
{
    $fromName = $_ENV['SMTP_FROM_NAME'] ?? 'Admin';
    $fromEmail = $_ENV['SMTP_FROM'] ?? '';

    $headers = "From: $fromName <$fromEmail>\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    return mail($to, $subject, $html, $headers);
}

function runWarning()
{
    logMessage("🚀 Starting deletion warning check...");

    // if (!file_exists(ENV_FILE)) {
    //     logMessage("❌ .env file not found at: " . ENV_FILE);
    //     exit(1);
    // }

    // loadEnv(ENV_FILE);
    // logMessage("✅ .env loaded");

    $db = new mysqli(
        '103.212.120.166',
        'btakyall_pboxdb',
        'Pbox11:14',
        'btakyall_patelbox'
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
        WHERE pud.hard_delete_at > NOW() 
          AND pud.hard_delete_at <= DATE_ADD(NOW(), INTERVAL 1 DAY)
    ");

    if (!$result) {
        logMessage("❌ Query failed: " . $db->error);
        sendErrorEmail("Query failed: " . $db->error);
        $db->close();
        exit(1);
    }

    $usersToWarn = $result->fetch_all(MYSQLI_ASSOC);

    if (count($usersToWarn) === 0) {
        logMessage("ℹ️  No users scheduled for deletion tomorrow");
        $db->close();
        rotateLog();
        return;
    }

    logMessage("📦 Found " . count($usersToWarn) . " users to be deleted tomorrow");

    $rowsHtml = '';
    foreach ($usersToWarn as $user) {
        $userId = htmlspecialchars($user['user_id']);
        $fullName = htmlspecialchars($user['fullName'] ?? 'Unknown');
        $email = htmlspecialchars($user['emailID'] ?? 'N/A');
        $mobile = htmlspecialchars($user['mobileNo'] ?? 'N/A');
        $hardDelete = htmlspecialchars($user['hard_delete_at'] ?? 'N/A');

        logMessage("👤 User $userId: $fullName ($email) - Deletion scheduled: $hardDelete");

        $rowsHtml .= "<tr>
            <td>$userId</td>
            <td>$fullName</td>
            <td>$email</td>
            <td>$mobile</td>
            <td>$hardDelete</td>
        </tr>\n";
    }

    $adminResult = $db->query("SELECT emailID FROM user WHERE isAdmin = 1 AND isActive = 1 AND deleted_at IS NULL");
    $admins = $adminResult ? $adminResult->fetch_all(MYSQLI_ASSOC) : [];

    if (count($admins) === 0) {
        logMessage("⚠️  No admin emails found to send warning");
        $db->close();
        rotateLog();
        return;
    }

    $currentDate = date('Y-m-d H:i:s');
    $subject = "[Warning] Bulk User Deletion Tomorrow - " . count($usersToWarn) . " users";

    $emailBody = "
    <h2>⚠️ Bulk User Deletion Warning</h2>
    <p>Date: $currentDate</p>
    <p>The following bulk users will be <strong>permanently deleted tomorrow</strong> at 00:00 IST:</p>
    <table border='1' cellpadding='8' cellspacing='0' style='border-collapse: collapse; width: 100%; max-width: 800px;'>
        <tr style='background: #f44336; color: white;'>
            <th>User ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>Deletion Time</th>
        </tr>
        $rowsHtml
    </table>
    <br>
    <p>If you want to preserve this data, please take action before tomorrow.</p>
    <hr>
    <p style='color: #666; font-size: 12px;'>This is an automated message from the system.</p>";

    $sentCount = 0;
    foreach ($admins as $admin) {
        $adminEmail = $admin['emailID'] ?? '';
        if (!empty($adminEmail)) {
            if (sendEmail($adminEmail, $subject, $emailBody)) {
                $sentCount++;
                logMessage("📧 Warning email sent to: $adminEmail");
            } else {
                logMessage("⚠️  Failed to send warning email to: $adminEmail");
            }
        }
    }

    logMessage("📧 Warning emails sent to $sentCount of " . count($admins) . " admins");

    $db->close();
    rotateLog();
    logMessage("✅ Warning script completed successfully");
}

function sendErrorEmail($errorMessage)
{
    $adminResult = null;
    try {
        $db = new mysqli(
            '103.212.120.166',
            'btakyall_pboxdb',
            'Pbox11:14',
            'btakyall_patelbox'
        );
        if (!$db->connect_error) {
            $result = $db->query("SELECT emailID FROM user WHERE isAdmin = 1 AND isActive = 1 AND deleted_at IS NULL");
            if ($result) {
                $admins = $result->fetch_all(MYSQLI_ASSOC);
                $currentDate = date('Y-m-d H:i:s');
                $subject = "[Error] Bulk User Warning Script Failed";

                $emailBody = "
                <h2>❌ Bulk User Warning Script Failed</h2>
                <p>Date: $currentDate</p>
                <p>Error: " . htmlspecialchars($errorMessage) . "</p>
                <p>Please check the logs for more details.</p>
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
        // Silently fail - can't send error email if DB is down
    }
}

runWarning();
