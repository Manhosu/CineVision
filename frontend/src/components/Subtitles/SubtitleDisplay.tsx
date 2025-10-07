'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { SubtitleCue, SubtitleOptions } from '@/services/subtitleService';

export interface SubtitleDisplayProps {
  cues: SubtitleCue[];
  options?: SubtitleOptions;
  className?: string;
  containerWidth?: number;
  containerHeight?: number;
}

const defaultOptions: Required<SubtitleOptions> = {
  fontSize: 16,
  fontFamily: 'Arial, sans-serif',
  color: '#FFFFFF',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  textShadow: true,
  position: 'bottom',
  opacity: 1,
};

const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({
  cues,
  options = {},
  className = '',
  containerWidth = 800,
  containerHeight = 450,
}) => {
  const [renderedCues, setRenderedCues] = useState<SubtitleCue[]>([]);

  const finalOptions = useMemo(() => ({
    ...defaultOptions,
    ...options,
  }), [options]);

  // Update rendered cues when cues change
  useEffect(() => {
    setRenderedCues(cues);
  }, [cues]);

  if (renderedCues.length === 0) {
    return null;
  }

  const getPositionStyles = (cue: SubtitleCue, index: number) => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute' as const,
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '90%',
      textAlign: 'center' as const,
      zIndex: 1000 + index,
    };

    // Handle VTT positioning
    if (cue.position) {
      const positionMatch = cue.position.match(/(\d+)%?/);
      if (positionMatch) {
        const positionPercent = parseInt(positionMatch[1], 10);
        baseStyles.left = `${positionPercent}%`;
      }
    }

    if (cue.line) {
      if (cue.line.endsWith('%')) {
        const linePercent = parseInt(cue.line.replace('%', ''), 10);
        baseStyles.top = `${linePercent}%`;
        baseStyles.transform = 'translate(-50%, -50%)';
      } else {
        const lineNumber = parseInt(cue.line, 10);
        if (lineNumber < 0) {
          // Negative line numbers count from bottom
          baseStyles.bottom = `${Math.abs(lineNumber) * 1.2}em`;
        } else {
          // Positive line numbers count from top
          baseStyles.top = `${lineNumber * 1.2}em`;
        }
      }
    } else {
      // Default positioning based on options
      switch (finalOptions.position) {
        case 'top':
          baseStyles.top = '10%';
          break;
        case 'center':
          baseStyles.top = '50%';
          baseStyles.transform = 'translate(-50%, -50%)';
          break;
        case 'bottom':
        default:
          baseStyles.bottom = '10%';
          // Stack multiple cues
          if (renderedCues.length > 1) {
            baseStyles.bottom = `${10 + index * 15}%`;
          }
          break;
      }
    }

    if (cue.size) {
      const sizeMatch = cue.size.match(/(\d+)%?/);
      if (sizeMatch) {
        baseStyles.maxWidth = `${parseInt(sizeMatch[1], 10)}%`;
      }
    }

    return baseStyles;
  };

  const getTextStyles = (): React.CSSProperties => {
    return {
      fontSize: `${finalOptions.fontSize}px`,
      fontFamily: finalOptions.fontFamily,
      color: finalOptions.color,
      backgroundColor: finalOptions.backgroundColor,
      padding: '0.3em 0.6em',
      borderRadius: '4px',
      display: 'inline-block',
      lineHeight: '1.2',
      wordBreak: 'break-word' as const,
      whiteSpace: 'pre-wrap' as const,
      textShadow: finalOptions.textShadow ? '2px 2px 4px rgba(0, 0, 0, 0.8)' : 'none',
      opacity: finalOptions.opacity,
      margin: '0.1em 0',
    };
  };

  const processSubtitleText = (text: string): React.ReactNode => {
    // Handle VTT formatting tags
    let processedText = text;

    // Replace VTT tags with HTML
    const replacements = [
      { pattern: /<c\.([^>]+)>(.*?)<\/c>/g, replacement: '<span class="subtitle-$1">$2</span>' },
      { pattern: /<c>(.*?)<\/c>/g, replacement: '<span class="subtitle-color">$1</span>' },
      { pattern: /<b>(.*?)<\/b>/g, replacement: '<strong>$1</strong>' },
      { pattern: /<i>(.*?)<\/i>/g, replacement: '<em>$1</em>' },
      { pattern: /<u>(.*?)<\/u>/g, replacement: '<u>$1</u>' },
      { pattern: /&lt;/g, replacement: '<' },
      { pattern: /&gt;/g, replacement: '>' },
      { pattern: /&amp;/g, replacement: '&' },
    ];

    for (const { pattern, replacement } of replacements) {
      processedText = processedText.replace(pattern, replacement);
    }

    // Split by line breaks and render
    const lines = processedText.split('\n');

    return lines.map((line, index) => (
      <div key={index} style={{ margin: '0.1em 0' }}>
        {/* Use dangerouslySetInnerHTML for HTML formatting but sanitize first */}
        <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(line) }} />
      </div>
    ));
  };

  const sanitizeHTML = (html: string): string => {
    // Basic HTML sanitization - allow only specific tags
    const allowedTags = ['strong', 'em', 'u', 'span'];
    const allowedAttributes = ['class'];

    let sanitized = html;

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove dangerous attributes
    sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Only allow specific tags
    const tagPattern = /<(\/?)([\w]+)([^>]*)>/g;
    sanitized = sanitized.replace(tagPattern, (match, closing, tagName, attributes) => {
      if (!allowedTags.includes(tagName.toLowerCase())) {
        return '';
      }

      // Clean attributes
      let cleanAttributes = '';
      if (attributes && allowedAttributes.length > 0) {
        const attrPattern = /(\w+)="([^"]*)"/g;
        let attrMatch;
        while ((attrMatch = attrPattern.exec(attributes)) !== null) {
          const [, attrName, attrValue] = attrMatch;
          if (allowedAttributes.includes(attrName.toLowerCase())) {
            cleanAttributes += ` ${attrName}="${attrValue}"`;
          }
        }
      }

      return `<${closing}${tagName}${cleanAttributes}>`;
    });

    return sanitized;
  };

  return (
    <div
      className={`subtitle-display ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {renderedCues.map((cue, index) => (
        <div
          key={`${cue.id}-${index}`}
          className="subtitle-cue"
          style={getPositionStyles(cue, index)}
        >
          <div
            className="subtitle-text"
            style={getTextStyles()}
          >
            {processSubtitleText(cue.text)}
          </div>
        </div>
      ))}

      {/* Custom CSS for subtitle classes */}
      <style jsx>{`
        .subtitle-display {
          font-smooth: always;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .subtitle-cue {
          animation: subtitle-fade-in 0.3s ease-in-out;
        }

        @keyframes subtitle-fade-in {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        /* VTT color classes */
        .subtitle-color { color: ${finalOptions.color}; }
        .subtitle-white { color: #ffffff; }
        .subtitle-lime { color: #00ff00; }
        .subtitle-cyan { color: #00ffff; }
        .subtitle-red { color: #ff0000; }
        .subtitle-yellow { color: #ffff00; }
        .subtitle-magenta { color: #ff00ff; }
        .subtitle-blue { color: #0000ff; }
        .subtitle-black { color: #000000; }

        /* Responsive font scaling */
        @media (max-width: 768px) {
          .subtitle-text {
            font-size: ${Math.max(14, finalOptions.fontSize * 0.9)}px !important;
            max-width: 95% !important;
          }
        }

        @media (max-width: 480px) {
          .subtitle-text {
            font-size: ${Math.max(12, finalOptions.fontSize * 0.8)}px !important;
            padding: 0.2em 0.4em !important;
          }
        }

        /* Smart TV scaling */
        @media (min-width: 1920px) {
          .subtitle-text {
            font-size: ${finalOptions.fontSize * 1.2}px !important;
          }
        }

        /* High DPI scaling */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
          .subtitle-text {
            text-shadow: ${finalOptions.textShadow ? '1px 1px 2px rgba(0, 0, 0, 0.8)' : 'none'} !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SubtitleDisplay;