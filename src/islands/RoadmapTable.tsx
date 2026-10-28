// Roadmap wave table. Server-rendered Cast components (no client directive).
import React from 'react';
import { Badge, Link, Progress, Table, TableBody, TableCell, TableHead, TableRow, Text, useTheme } from '@castui/cast-ui';
import { View } from 'react-native';
import CastRoot from '../cast/CastRoot';

export type RoadmapRow = { label: string; href: string; phase: string; done: boolean };

export function RoadmapTable({ rows }: { rows: RoadmapRow[] }) {
  return (
    <CastRoot>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell flex={3}>Topic</TableCell>
            <TableCell flex={1.4}>Phase</TableCell>
            <TableCell flex={1.4}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.href}>
              <TableCell flex={3}>
                <Link href={r.href} size="small" underline="hover">
                  {r.label}
                </Link>
              </TableCell>
              <TableCell flex={1.4}>{r.phase}</TableCell>
              <TableCell flex={1.4}>
                {r.done ? (
                  <Badge size="small" intent="brand" variant="subtle" leadingIcon="check">
                    Rebuilt
                  </Badge>
                ) : (
                  <Badge size="small" variant="outline" leadingIcon="history">
                    v1 archive
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CastRoot>
  );
}

export function RoadmapSummary({ done, total, primers }: { done: number; total: number; primers: number }) {
  return (
    <CastRoot>
      <Summary done={done} total={total} primers={primers} />
    </CastRoot>
  );
}

function Summary({ done, total, primers }: { done: number; total: number; primers: number }) {
  const { scheme } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Progress value={(done / total) * 100} accessibilityLabel={`${done} of ${total} topics rebuilt`} />
      <Text type="body-md" color={scheme.text.description}>
        {`${done} of ${total} v1 topics rebuilt, plus ${primers} new primer page${primers === 1 ? '' : 's'}.`}
      </Text>
    </View>
  );
}
