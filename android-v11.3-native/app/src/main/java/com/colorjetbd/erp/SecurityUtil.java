package com.colorjetbd.erp;

import android.util.Base64;

import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public final class SecurityUtil {
    private static final int ITERATIONS = 210_000;
    private static final int KEY_LENGTH_BITS = 256;
    private static final int SALT_BYTES = 16;

    private SecurityUtil() { }

    public static PasswordHash hashPassword(String password) {
        try {
            byte[] salt = new byte[SALT_BYTES];
            new SecureRandom().nextBytes(salt);
            byte[] hash = derive(password, salt);
            return new PasswordHash(
                Base64.encodeToString(salt, Base64.NO_WRAP),
                Base64.encodeToString(hash, Base64.NO_WRAP)
            );
        } catch (Exception error) {
            throw new IllegalStateException("Unable to protect the password.", error);
        }
    }

    public static boolean verifyPassword(String password, String saltBase64, String expectedHashBase64) {
        try {
            byte[] salt = Base64.decode(saltBase64, Base64.NO_WRAP);
            byte[] expected = Base64.decode(expectedHashBase64, Base64.NO_WRAP);
            byte[] actual = derive(password, salt);
            return MessageDigest.isEqual(expected, actual);
        } catch (Exception ignored) {
            return false;
        }
    }

    private static byte[] derive(String password, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_LENGTH_BITS);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1").generateSecret(spec).getEncoded();
        } finally {
            spec.clearPassword();
        }
    }

    public static final class PasswordHash {
        public final String salt;
        public final String hash;

        PasswordHash(String salt, String hash) {
            this.salt = salt;
            this.hash = hash;
        }
    }
}
