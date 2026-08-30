<?php
/**
 * Plugin Name: SDM Sync Bypass
 * Description: Custom REST endpoints used by the SDM migration sync-service (Node) to fetch Fichas and Clientes across ALL post statuses (publish, pending, draft, trash). Pods' own REST controller for these two CPTs rejects context=edit and per-status requests for this account with a 403 (its capability_type was never mapped to a role, so no account — including Administrator — passes the check). This endpoint runs its own WP_Query directly, bypassing Pods' REST controller and its capability check entirely, and is protected instead by a shared secret header.
 *
 * Install: upload this file into wp-content/mu-plugins/ (create that folder if it
 * doesn't exist — anything placed there loads automatically, no activation needed).
 *
 * Requires: define('SDM_SYNC_SECRET', '...a long random string...'); in wp-config.php,
 * matching the WP_SYNC_BYPASS_SECRET environment variable configured on the Node backend.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route('sdm-sync/v1', '/(?P<slug>fichas|clientes)', [
        'methods' => 'GET',
        'callback' => 'sdm_sync_fetch_all_statuses',
        'permission_callback' => 'sdm_sync_check_secret',
        'args' => [
            'page' => ['default' => 1],
            'per_page' => ['default' => 100],
        ],
    ]);
});

function sdm_sync_check_secret(WP_REST_Request $request) {
    $expected = defined('SDM_SYNC_SECRET') ? SDM_SYNC_SECRET : getenv('SDM_SYNC_SECRET');
    $provided = $request->get_header('x_sdm_sync_secret');

    if (!$expected || !$provided || !hash_equals((string) $expected, (string) $provided)) {
        return new WP_Error('sdm_sync_forbidden', 'Invalid or missing sync secret', ['status' => 403]);
    }

    return true;
}

function sdm_sync_fetch_all_statuses(WP_REST_Request $request) {
    $slug_to_post_type = [
        'fichas' => 'ficha',
        'clientes' => 'cliente',
    ];
    $post_type = $slug_to_post_type[$request['slug']] ?? null;

    if (!$post_type || !post_type_exists($post_type)) {
        return new WP_Error('sdm_sync_invalid_post_type', 'Unknown post type', ['status' => 404]);
    }

    $query = new WP_Query([
        'post_type' => $post_type,
        'post_status' => ['publish', 'pending', 'draft', 'trash'],
        'posts_per_page' => max(1, min(100, (int) $request['per_page'])),
        'paged' => max(1, (int) $request['page']),
        'orderby' => 'ID',
        'order' => 'ASC',
        'no_found_rows' => true,
        'ignore_sticky_posts' => true,
    ]);

    $items = array_map('sdm_sync_format_post', $query->posts);

    return new WP_REST_Response($items, 200);
}

function sdm_sync_format_post(WP_Post $post) {
    $data = [
        'id' => $post->ID,
        'status' => $post->post_status,
        'date' => $post->post_date,
        'date_gmt' => $post->post_date_gmt,
        'modified' => $post->post_modified,
        'modified_gmt' => $post->post_modified_gmt,
        'author' => (int) $post->post_author,
        'title' => ['rendered' => get_the_title($post)],
        'content' => ['rendered' => $post->post_content],
        'excerpt' => ['rendered' => $post->post_excerpt],
        'slug' => $post->post_name,
        'parent' => (int) $post->post_parent,
        'menu_order' => (int) $post->menu_order,
        'guid' => ['rendered' => $post->guid],
        'link' => get_permalink($post),
        'comment_status' => $post->comment_status,
        'ping_status' => $post->ping_status,
        'comment_count' => (int) $post->comment_count,
    ];

    // Fichas carry a Pods relationship field ("cliente") pointing at the
    // related client post — exposed here the same way sync-service.js's
    // extractClientLegacyId() already knows how to read it (bare ID, array
    // of IDs, or array of objects with an id/ID key).
    if ($post->post_type === 'ficha' && function_exists('pods')) {
        $pod = pods('ficha', $post->ID);
        if ($pod && $pod->exists()) {
            $data['cliente'] = $pod->field('cliente');
        }
    }

    return $data;
}
